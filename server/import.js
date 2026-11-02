import { execFile, spawn } from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline';
import { promisify } from 'node:util';
import { FORMATS, SHAPES } from '../shared/spec.js';
import { transaction } from './db.js';
import { badRequest } from './errors.js';
import { createLayer } from './layers.js';

const run = promisify(execFile);
const MAX_OUTPUT = 16 * 1024 ** 2; // for ogrinfo summaries and archive listings
const CHUNK = 5000;

/**
 * Imports every spatial layer in an uploaded file into a map, all or nothing.
 * A source layer holding more than one kind of geometry becomes one map layer
 * per kind.
 *
 * @param {{ originalname: string, path: string }} file a multer upload; the
 *   extension of `originalname` picks the format
 * @param {number} mapId an existing map's id
 * @returns the new layer rows
 * @throws a 400 error for unsupported or unreadable files, a 404 error if the map doesn't exist
 */
export async function importFile(file, mapId) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!Object.hasOwn(FORMATS, ext)) throw badRequest(`Unsupported file type: ${ext || 'none'}`);
  const drivers = FORMATS[ext].flatMap((driver) => ['-if', driver]);

  const base = path.basename(file.originalname, ext);
  const sources = ext === '.zip' || ext === '.kmz'
    ? await archiveSources(file.path, ext === '.zip' ? '.shp' : '.kml')
    : [file.path];

  return transaction(async (db) => {
    await db.query('CREATE TEMP TABLE staging (geom geometry, props jsonb) ON COMMIT DROP');
    const layers = [];
    for (const source of sources) {
      for (const info of await describe(source, drivers)) {
        const name = sources.length > 1 || info.many ? info.name : base;
        layers.push(...(await store(db, mapId, name, info, readFeatures(source, info, drivers))));
      }
    }
    if (!layers.length) throw badRequest('No features found in that file.');
    return layers;
  });
}

// Archives are read in place through GDAL's /vsizip/, so nothing is extracted.
async function archiveSources(file, wanted) {
  const { stdout } = await run('gdal', ['vsi', 'list', '-R', '--of', 'json', `/vsizip/${file}`], { maxBuffer: MAX_OUTPUT })
    .catch(() => {
      throw badRequest('Could not open that archive.');
    });
  const entries = JSON.parse(stdout);
  // An archive holding a single file lists as just its own path, because
  // GDAL then treats the archive as that file. The pinned driver still
  // decides whether it can be read.
  if (!Array.isArray(entries)) return [`/vsizip/${file}`];
  const found = entries.filter(
    (entry) => entry.toLowerCase().endsWith(wanted) && !entry.split('/').some((part) => part === '..' || part === '__MACOSX'),
  );
  if (!found.length) throw badRequest(`No ${wanted} file found in that archive.`);
  return found.map((entry) => `/vsizip/${file}/${entry}`);
}

async function describe(source, drivers) {
  const { stdout } = await run('ogrinfo', [...drivers, '-json', '-so', '-ro', source], { maxBuffer: MAX_OUTPUT }).catch(gdalError);
  const layers = JSON.parse(stdout).layers.filter((layer) => layer.geometryFields?.length);
  return layers.map((layer) => ({
    name: layer.name,
    many: layers.length > 1,
    hasCrs: Boolean(layer.geometryFields[0].coordinateSystem),
  }));
}

// Streams features from ogr2ogr one line at a time, so memory use doesn't
// grow with the size of the file.
async function* readFeatures(source, info, drivers) {
  const args = [...drivers, '-f', 'GeoJSONSeq', '/vsistdout/', source, info.name, '-t_srs', 'EPSG:4326', '-dim', 'XY', '-lco', 'RS=NO'];
  if (!info.hasCrs) args.push('-s_srs', 'EPSG:4326');
  const child = spawn('ogr2ogr', args);
  let stderr = '';
  child.stderr.setEncoding('utf8').on('data', (chunk) => {
    if (stderr.length < 64 * 1024) stderr += chunk;
  });
  const exited = new Promise((resolve) => {
    child.on('error', (error) => resolve({ error }));
    child.on('close', (code) => resolve({ code }));
  });
  try {
    for await (const line of readline.createInterface({ input: child.stdout, crlfDelay: Infinity })) {
      if (!line) continue;
      const feature = JSON.parse(line);
      if (feature.geometry) yield feature;
    }
    const { code, error } = await exited;
    if (error || code !== 0) gdalError({ stderr, message: error?.message ?? `ogr2ogr exited with code ${code}` });
  } finally {
    // Stops ogr2ogr if the caller gave up part way, e.g. on a database error.
    if (child.exitCode === null && child.signalCode === null) child.kill();
  }
}

async function store(db, mapId, name, info, features) {
  await db.query('TRUNCATE staging');
  let batch = [];
  for await (const feature of features) {
    batch.push(feature);
    if (batch.length === CHUNK) {
      await stage(db, batch);
      batch = [];
    }
  }
  if (batch.length) await stage(db, batch);

  if (!info.hasCrs) {
    const { rowCount: outOfRange } = await db.query(
      'SELECT 1 FROM staging WHERE ST_XMin(geom) < -180 OR ST_XMax(geom) > 180 OR ST_YMin(geom) < -90 OR ST_YMax(geom) > 90 LIMIT 1',
    );
    if (outOfRange) throw badRequest(`"${name}" has no coordinate system and isn't in longitude/latitude. Include its .prj file.`);
  }

  // ST_CollectionExtract type: 1 point, 2 line, 3 polygon.
  const { rows } = await db.query(
    'SELECT t FROM generate_series(1, 3) t WHERE EXISTS (SELECT 1 FROM staging WHERE NOT ST_IsEmpty(ST_CollectionExtract(geom, t)))',
  );
  const layers = [];
  for (const { t } of rows) {
    const shape = SHAPES[t - 1];
    const layer = await createLayer(db, mapId, rows.length > 1 ? `${name} (${shape}s)` : name, shape);
    await db.query(
      `INSERT INTO features (layer_id, geom, props)
       SELECT $1, g, props FROM staging, ST_CollectionExtract(geom, $2::int) g WHERE NOT ST_IsEmpty(g)`,
      [layer.id, t],
    );
    layers.push(layer);
  }
  return layers;
}

// Repairs each geometry. A repaired polygon can gain stray lines or points
// where it collapsed, so it's cut back to its own kind; only a source
// GeometryCollection keeps a mix, which store() then splits by kind.
async function stage(db, features) {
  await db.query(
    `INSERT INTO staging
     SELECT geom, props FROM (
       SELECT CASE WHEN GeometryType(g) = 'GEOMETRYCOLLECTION' THEN ST_MakeValid(g)
                   ELSE ST_CollectionExtract(ST_MakeValid(g), ST_Dimension(g) + 1) END AS geom,
              props
       FROM (
         SELECT ST_SetSRID(ST_GeomFromGeoJSON(f->'geometry'), 4326) AS g, coalesce(f->'properties', '{}') AS props
         FROM jsonb_array_elements($1::jsonb) f
       ) raw
     ) s WHERE NOT ST_IsEmpty(geom)`,
    [JSON.stringify(features)],
  );
}

function gdalError(error) {
  const line = error.stderr?.split('\n').find((l) => l.startsWith('ERROR')) ?? error.message;
  throw badRequest(`Could not read that file: ${line}`);
}
