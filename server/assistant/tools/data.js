// Tools for getting data into a map: uploading a file from the user's
// computer, or sending a few features inline.
//
// The app usually runs in Docker, where it can't see the user's files. So
// upload_file doesn't read the file itself: it gives the assistant a command
// that sends it to the app's import route, the one the browser uses. The
// file's contents then never pass through the model, however big it is.
// That needs an assistant that can run commands on the user's computer,
// such as Claude Code; add_features works without one, for small data.
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as z from 'zod';
import { badRequest } from '../../errors.js';
import { importFile } from '../../import.js';
import { getMap } from '../../maps.js';
import { parseLayerName } from '../../validation.js';
import { FORMATS } from '../../../shared/spec.js';
import { mapId } from '../schemas.js';
import { newLayerSummary } from '../summaries.js';

const EXTENSIONS = Object.keys(FORMATS).join(', ');

export const dataTools = [
  {
    name: 'upload_file',
    title: 'Upload a file',
    description:
      `Adds a spatial file from the user's computer to a map as one or more layers. Supported: ${EXTENSIONS} `
      + '(a Shapefile must be zipped with its .dbf, .shx and .prj). This tool doesn\'t upload anything itself: '
      + 'it returns a shell command that does. Run that command on the user\'s computer, from the folder the path is relative to; '
      + 'it prints the new layers as JSON, or { "error": "…" }. Upload several files with one command each. '
      + 'If you can\'t run commands, use add_features for small data instead.',
    input: {
      map_id: mapId,
      path: z.string().min(1).describe('The file\'s path on the user\'s computer, absolute or relative to where the command will run.'),
    },
    readOnly: true, // it only writes a command; running that command adds the layers
    run: async ({ map_id, path: file }, { baseUrl }) => {
      const ext = path.extname(file).toLowerCase();
      if (!Object.hasOwn(FORMATS, ext)) throw badRequest(`Unsupported file type: ${ext || 'none'}. Supported: ${EXTENSIONS}.`);
      const map = await getMap(map_id);
      return { map_id: map.id, command: uploadCommand(file, `${baseUrl}/api/maps/${map.id}/import`) };
    },
  },
  {
    name: 'add_features',
    title: 'Add features',
    description:
      'Adds a new layer to a map from a GeoJSON FeatureCollection given inline, in longitude/latitude (WGS84). '
      + 'For small data only, such as points you were given in the conversation: everything you send costs tokens. '
      + 'To load a file, use upload_file. Mixed points, lines and areas become one layer per kind. '
      + 'Properties whose values are all numbers written as text are stored as numbers.',
    input: {
      map_id: mapId,
      name: z.string().min(1).describe('The new layer\'s name.'),
      geojson: z.object({ type: z.literal('FeatureCollection'), features: z.array(z.looseObject({})) })
        .describe('A GeoJSON FeatureCollection.'),
    },
    run: async ({ map_id, name, geojson }) => {
      const layerName = parseLayerName(name);
      if (!layerName) throw badRequest('Give the layer a name.');
      const map = await getMap(map_id);
      // Written to a file so it goes through the same import as an upload.
      const dir = await mkdtemp(path.join(tmpdir(), 'spatial-features-'));
      try {
        const file = path.join(dir, 'features.geojson');
        await writeFile(file, JSON.stringify(geojson));
        const layers = await importFile({ originalname: 'features.geojson', path: file }, map.id, { name: layerName });
        return { layers: await Promise.all(layers.map(newLayerSummary)) };
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  },
];

/**
 * A curl command that uploads `file` to `url` as the form field `file`.
 *
 * The path is in double quotes inside curl's `-F` value, so curl reads
 * commas and semicolons in it as part of the name (unquoted, they start
 * curl's own options), with `\` and `"` escaped for curl. That whole value is
 * then in single quotes for the shell, so nothing in it is expanded.
 * `--fail-with-body` makes an error exit non-zero and still print why.
 *
 * @param {string} file
 * @param {string} url
 */
export function uploadCommand(file, url) {
  const forCurl = `file=@"${file.replace(/[\\"]/g, '\\$&')}"`;
  return `curl -sS --fail-with-body -F ${shellQuote(forCurl)} ${shellQuote(url)}`;
}

// Single-quoted for a POSIX shell: a ' inside is closed, escaped and reopened.
const shellQuote = (text) => `'${text.replace(/'/g, "'\\''")}'`;
