import { execFile } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { badRequest, createLayer, transaction } from './db.js';

const run = promisify(execFile);
const MAX_OUTPUT = 1024 ** 3;
const CHUNK = 5000;
const SHAPES = ['point', 'line', 'polygon']; // indexed by ST_Dimension

export const EXTENSIONS = ['.geojson', '.json', '.zip', '.kml', '.kmz', '.gpx', '.gpkg', '.fgb', '.topojson'];

// Imports every spatial layer in the file. A source layer holding more than
// one kind of geometry becomes one map layer per kind.
export async function importFile(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!EXTENSIONS.includes(ext)) throw badRequest(`Unsupported file type: ${ext || 'none'}`);

  const base = path.basename(file.originalname, ext);
  const dir = await mkdtemp(path.join(tmpdir(), 'import-'));
  try {
    const sources = ext === '.zip' || ext === '.kmz' ? await unzip(file.path, dir, ext) : [file.path];
    const layers = [];
    for (const source of sources) {
      for (const info of await describe(source)) {
        const features = await read(source, info);
        const name = sources.length > 1 || info.many ? info.name : base;
        layers.push(...(await store(name, features)));
      }
    }
    if (!layers.length) throw badRequest('No features found in that file.');
    return layers;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function unzip(file, dir, ext) {
  await run('unzip', ['-qo', file, '-d', dir]).catch(() => {
    throw badRequest('Could not unzip that file.');
  });
  const wanted = ext === '.zip' ? '.shp' : '.kml';
  const found = (await readdir(dir, { recursive: true }))
    .filter((name) => name.toLowerCase().endsWith(wanted) && !name.includes('__MACOSX'))
    .map((name) => path.join(dir, name));
  if (!found.length) throw badRequest(`No ${wanted} file found in that archive.`);
  return found;
}

async function describe(source) {
  const { stdout } = await run('ogrinfo', ['-json', '-so', '-ro', source], { maxBuffer: MAX_OUTPUT }).catch(gdalError);
  const layers = JSON.parse(stdout).layers.filter((layer) => layer.geometryFields?.length);
  return layers.map((layer) => ({
    name: layer.name,
    many: layers.length > 1,
    hasCrs: Boolean(layer.geometryFields[0].coordinateSystem),
  }));
}

async function read(source, info) {
  const args = ['-f', 'GeoJSONSeq', '/vsistdout/', source, info.name, '-t_srs', 'EPSG:4326', '-dim', 'XY', '-lco', 'RS=NO'];
  if (!info.hasCrs) args.push('-s_srs', 'EPSG:4326');
  const { stdout } = await run('ogr2ogr', args, { maxBuffer: MAX_OUTPUT }).catch(gdalError);
  return stdout.split('\n').filter(Boolean).map((line) => JSON.parse(line)).filter((f) => f.geometry);
}

async function store(name, features) {
  return transaction(async (db) => {
    await db.query('CREATE TEMP TABLE staging (geom geometry, props jsonb) ON COMMIT DROP');
    for (let i = 0; i < features.length; i += CHUNK) {
      await db.query(
        `INSERT INTO staging
         SELECT * FROM (
           SELECT ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(f->'geometry'), 4326)) AS geom, coalesce(f->'properties', '{}') AS props
           FROM jsonb_array_elements($1::jsonb) f
         ) s WHERE NOT ST_IsEmpty(geom)`,
        [JSON.stringify(features.slice(i, i + CHUNK))],
      );
    }
    const { rowCount: outOfRange } = await db.query(
      'SELECT 1 FROM staging WHERE ST_XMin(geom) < -180 OR ST_XMax(geom) > 180 OR ST_YMin(geom) < -90 OR ST_YMax(geom) > 90 LIMIT 1',
    );
    if (outOfRange) throw badRequest(`"${name}" has no coordinate system and isn't in longitude/latitude. Include its .prj file.`);
    const { rows } = await db.query('SELECT DISTINCT ST_Dimension(geom) AS dim FROM staging ORDER BY 1');
    const layers = [];
    for (const { dim } of rows) {
      const shape = SHAPES[dim];
      const layer = await createLayer(db, rows.length > 1 ? `${name} (${shape}s)` : name, shape);
      await db.query(
        `INSERT INTO features (layer_id, geom, props)
         SELECT $1, ST_CollectionExtract(geom, $2::int + 1), props FROM staging WHERE ST_Dimension(geom) = $2`,
        [layer.id, dim],
      );
      layers.push(layer);
    }
    return layers;
  });
}

function gdalError(error) {
  const line = error.stderr?.split('\n').find((l) => l.startsWith('ERROR')) ?? error.message;
  throw badRequest(`Could not read that file: ${line}`);
}
