// Reading uploaded files with GDAL. Everything here runs GDAL's command-line
// tools on files a user chose, so two rules hold throughout:
//
// - Each file is read with the drivers listed for its extension in
//   shared/spec.js, never whatever GDAL guesses from its contents.
// - Nothing from inside a file is passed as an argument on its own. Values
//   such as a layer's name go in `--option=value` form, so a layer called
//   "--version" (or any other option) can only ever be read as a name.
import { execFile, spawn } from 'node:child_process';
import readline from 'node:readline';
import { promisify } from 'node:util';
import { badRequest } from './errors.js';

const run = promisify(execFile);

const MAX_OUTPUT = 16 * 1024 ** 2; // for ogrinfo summaries and archive listings

/** How long one GDAL command may take before it's stopped. Generous, as files can be large. */
export const GDAL_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * The paths GDAL should read inside a zip archive: every entry ending in
 * `wanted` (such as `.shp`). Archives are read in place through GDAL's
 * /vsizip/, so nothing is extracted. Entries that climb out of the archive
 * (`..`) or are macOS metadata are skipped.
 *
 * @param {string} file the archive on disk
 * @param {string} wanted the extension to look for, lower case
 * @returns {Promise<string[]>}
 */
export async function archiveSources(file, wanted) {
  const { stdout } = await run('gdal', ['vsi', 'list', '-R', '--of', 'json', `/vsizip/${file}`], { maxBuffer: MAX_OUTPUT, timeout: GDAL_TIMEOUT_MS })
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

/**
 * The spatial layers in a file: each one's name, whether the file has more
 * than one, and whether it says what coordinate system it's in.
 *
 * @param {string} source a path GDAL can open (always one we built)
 * @param {string[]} drivers the GDAL drivers allowed to read it
 * @returns {Promise<Array<{ name: string, many: boolean, hasCrs: boolean }>>}
 */
export async function describe(source, drivers) {
  const args = [...drivers.flatMap((driver) => ['-if', driver]), '-json', '-so', '-ro', source];
  const { stdout } = await run('ogrinfo', args, { maxBuffer: MAX_OUTPUT, timeout: GDAL_TIMEOUT_MS }).catch(gdalError);
  const layers = JSON.parse(stdout).layers.filter((layer) => layer.geometryFields?.length);
  return layers.map((layer) => ({
    name: layer.name,
    many: layers.length > 1,
    hasCrs: Boolean(layer.geometryFields[0].coordinateSystem),
  }));
}

/**
 * Streams one layer's features as GeoJSON objects in longitude/latitude
 * (WGS84), two-dimensional, one line at a time from `gdal vector pipeline`,
 * so memory use doesn't grow with the size of the file. A layer with no
 * coordinate system is taken to be in longitude/latitude already.
 *
 * Features without a geometry are skipped. Throws a 400 if GDAL fails or
 * takes longer than GDAL_TIMEOUT_MS.
 *
 * @param {string} source
 * @param {{ name: string, hasCrs: boolean }} info the layer, from describe()
 * @param {string[]} drivers
 */
export async function* readFeatures(source, info, drivers) {
  const args = [
    'vector', 'pipeline',
    'read', `--input-format=${drivers.join(',')}`, `--input-layer=${info.name}`, source,
    '!', 'reproject', ...(info.hasCrs ? [] : ['--src-crs=EPSG:4326']), '--dst-crs=EPSG:4326',
    '!', 'set-geom-type', '--dim=XY',
    '!', 'write', '--output-format=GeoJSONSeq', '--lco=RS=NO', '/vsistdout/',
  ];
  const child = spawn('gdal', args);
  let stderr = '';
  child.stderr.setEncoding('utf8').on('data', (chunk) => {
    if (stderr.length < 64 * 1024) stderr += chunk;
  });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill();
  }, GDAL_TIMEOUT_MS);
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
    if (timedOut) throw badRequest(`Reading "${info.name}" took longer than ${GDAL_TIMEOUT_MS / 60000} minutes, so it was stopped.`);
    if (error || code !== 0) gdalError({ stderr, message: error?.message ?? `gdal exited with code ${code}` });
  } finally {
    clearTimeout(timer);
    // Stops GDAL if the caller gave up part way, e.g. on a database error.
    if (child.exitCode === null && child.signalCode === null) child.kill();
  }
}

// GDAL's first ERROR line, as a message for the user.
function gdalError(error) {
  const line = error.stderr?.split('\n').find((l) => l.startsWith('ERROR')) ?? error.message;
  throw badRequest(`Could not read that file: ${line}`);
}
