import { BadRequestException, Injectable } from '@nestjs/common';
import path from 'node:path';
import { FORMATS, SHAPES } from '../../../shared/spec.js';
import { DatabaseService, type Db } from '../database/database.service.js';
import type { LayerRow, Shape } from '../layers/layer.js';
import { LayersService } from '../layers/layers.service.js';
import { archiveSources, describe, readFeatures, type Feature, type SourceLayer } from './gdal.js';

const CHUNK = 5000;

export interface UploadedFile {
  originalname: string;
  path: string;
}

@Injectable()
export class ImportService {
  constructor(
    private readonly db: DatabaseService,
    private readonly layers: LayersService,
  ) {}

  // Imports every spatial layer in an uploaded file into a map, all or nothing.
  // A source layer holding more than one kind of geometry becomes one map layer
  // per kind.
  async importFile(file: UploadedFile, mapId: number): Promise<LayerRow[]> {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!Object.hasOwn(FORMATS, ext)) throw new BadRequestException(`Unsupported file type: ${ext || 'none'}`);
    // Naming the drivers stops GDAL choosing one by sniffing the contents.
    const drivers = FORMATS[ext as keyof typeof FORMATS].flatMap((driver) => ['-if', driver]);

    const base = path.basename(file.originalname, ext);
    const sources = ext === '.zip' || ext === '.kmz'
      ? await archiveSources(file.path, ext === '.zip' ? '.shp' : '.kml')
      : [file.path];

    return this.db.transaction(async (db) => {
      await db.query('CREATE TEMP TABLE staging (geom geometry, props jsonb) ON COMMIT DROP');
      const layers: LayerRow[] = [];
      for (const source of sources) {
        for (const info of await describe(source, drivers)) {
          const name = sources.length > 1 || info.many ? info.name : base;
          layers.push(...(await this.store(db, mapId, name, info, readFeatures(source, info, drivers))));
        }
      }
      if (!layers.length) throw new BadRequestException('No features found in that file.');
      return layers;
    });
  }

  private async store(db: Db, mapId: number, name: string, info: SourceLayer, features: AsyncIterable<Feature>) {
    await db.query('TRUNCATE staging');
    let batch: Feature[] = [];
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
      if (outOfRange) {
        throw new BadRequestException(`"${name}" has no coordinate system and isn't in longitude/latitude. Include its .prj file.`);
      }
    }

    // ST_CollectionExtract type: 1 point, 2 line, 3 polygon.
    const { rows } = await db.query<{ t: number }>(
      'SELECT t FROM generate_series(1, 3) t WHERE EXISTS (SELECT 1 FROM staging WHERE NOT ST_IsEmpty(ST_CollectionExtract(geom, t)))',
    );
    const layers: LayerRow[] = [];
    for (const { t } of rows) {
      const shape = SHAPES[t - 1] as Shape;
      const layer = await this.layers.create(db, mapId, rows.length > 1 ? `${name} (${shape}s)` : name, shape);
      await db.query(
        `INSERT INTO features (layer_id, geom, props)
         SELECT $1, g, props FROM staging, ST_CollectionExtract(geom, $2::int) g WHERE NOT ST_IsEmpty(g)`,
        [layer.id, t],
      );
      layers.push(layer);
    }
    return layers;
  }
}

// Repairs each geometry. A repaired polygon can gain stray lines or points
// where it collapsed, so it's cut back to its own kind; only a source
// GeometryCollection keeps a mix, which store() then splits by kind.
async function stage(db: Db, features: Feature[]) {
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
