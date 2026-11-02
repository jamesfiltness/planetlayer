import { BadRequestException } from '@nestjs/common';
import { execFile, spawn } from 'node:child_process';
import readline from 'node:readline';
import { promisify } from 'node:util';

const run = promisify(execFile);
const MAX_OUTPUT = 16 * 1024 ** 2; // for ogrinfo summaries and archive listings

export interface SourceLayer {
  name: string;
  many: boolean; // the source holds more than one layer
  hasCrs: boolean;
}

export interface Feature {
  geometry: object | null;
  properties?: Record<string, unknown> | null;
}

// Archives are read in place through GDAL's /vsizip/, so nothing is extracted.
export async function archiveSources(file: string, wanted: string): Promise<string[]> {
  const { stdout } = await run('gdal', ['vsi', 'list', '-R', '--of', 'json', `/vsizip/${file}`], { maxBuffer: MAX_OUTPUT })
    .catch(() => {
      throw new BadRequestException('Could not open that archive.');
    });
  const entries: unknown = JSON.parse(stdout);
  // An archive holding a single file lists as just its own path, because
  // GDAL then treats the archive as that file. The pinned driver still
  // decides whether it can be read.
  if (!Array.isArray(entries)) return [`/vsizip/${file}`];
  const found = (entries as string[]).filter(
    (entry) => entry.toLowerCase().endsWith(wanted) && !entry.split('/').some((part) => part === '..' || part === '__MACOSX'),
  );
  if (!found.length) throw new BadRequestException(`No ${wanted} file found in that archive.`);
  return found.map((entry) => `/vsizip/${file}/${entry}`);
}

export async function describe(source: string, drivers: string[]): Promise<SourceLayer[]> {
  const { stdout } = await run('ogrinfo', [...drivers, '-json', '-so', '-ro', source], { maxBuffer: MAX_OUTPUT }).catch(gdalError);
  const layers = JSON.parse(stdout).layers.filter((layer: any) => layer.geometryFields?.length);
  return layers.map((layer: any) => ({
    name: layer.name,
    many: layers.length > 1,
    hasCrs: Boolean(layer.geometryFields[0].coordinateSystem),
  }));
}

// Streams features from ogr2ogr one line at a time, so memory use doesn't
// grow with the size of the file.
export async function* readFeatures(source: string, layer: SourceLayer, drivers: string[]): AsyncGenerator<Feature> {
  const args = [...drivers, '-f', 'GeoJSONSeq', '/vsistdout/', source, layer.name, '-t_srs', 'EPSG:4326', '-dim', 'XY', '-lco', 'RS=NO'];
  if (!layer.hasCrs) args.push('-s_srs', 'EPSG:4326');
  const child = spawn('ogr2ogr', args);
  let stderr = '';
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
    if (stderr.length < 64 * 1024) stderr += chunk;
  });
  const exited = new Promise<{ code?: number | null; error?: Error }>((resolve) => {
    child.on('error', (error) => resolve({ error }));
    child.on('close', (code) => resolve({ code }));
  });
  try {
    for await (const line of readline.createInterface({ input: child.stdout, crlfDelay: Infinity })) {
      if (!line) continue;
      const feature: Feature = JSON.parse(line);
      if (feature.geometry) yield feature;
    }
    const { code, error } = await exited;
    if (error || code !== 0) gdalError({ stderr, message: error?.message ?? `ogr2ogr exited with code ${code}` });
  } finally {
    // Stops ogr2ogr if the caller gave up part way, e.g. on a database error.
    if (child.exitCode === null && child.signalCode === null) child.kill();
  }
}

function gdalError(error: { stderr?: string; message: string }): never {
  const line = error.stderr?.split('\n').find((l) => l.startsWith('ERROR')) ?? error.message;
  throw new BadRequestException(`Could not read that file: ${line}`);
}
