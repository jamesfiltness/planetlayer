import { BadRequestException, Injectable } from '@nestjs/common';
import { TOOLS } from '../../../shared/spec.js';
import { parseId } from '../common/ids.js';
import { DatabaseService, type Db } from '../database/database.service.js';
import type { LayerRow } from '../layers/layer.js';
import { LayersService } from '../layers/layers.service.js';
import { TOOL_QUERIES, type PickedLayers, type ToolParams } from './tool-queries.js';

// The parts of a tool's form fields the server reads; see shared/spec.js.
interface ToolSpec {
  id: string;
  fields: { key: string; label: string; shapes?: string[]; sameShapeAs?: string }[];
}

const SPECS: ToolSpec[] = TOOLS;

@Injectable()
export class ToolsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly layers: LayersService,
  ) {}

  async run(mapId: number, toolId: string, params: unknown = {}): Promise<LayerRow> {
    const tool = SPECS.find((t) => t.id === toolId);
    if (!tool || !Object.hasOwn(TOOL_QUERIES, toolId)) throw new BadRequestException(`Unknown tool: ${toolId}`);
    if (typeof params !== 'object' || params === null) throw new BadRequestException('Expected a JSON object.');
    const values = params as ToolParams;

    return this.db.transaction(async (db) => {
      const picked: PickedLayers = {};
      for (const field of tool.fields) {
        const shapes = field.shapes ?? (field.sameShapeAs ? [picked[field.sameShapeAs].shape] : undefined);
        if (shapes) picked[field.key] = await loadLayer(db, mapId, values[field.key], field.label, shapes);
      }
      const { name, shape, args, sql } = TOOL_QUERIES[toolId](picked, values);
      const custom = typeof values.name === 'string' ? values.name.trim() : '';
      const layer = await this.layers.create(db, mapId, custom || name, shape);

      // The new layer's id is bound after the tool's own parameters.
      const target = `$${args.length + 1}`;
      const { rowCount } = await db.query(
        `INSERT INTO features (layer_id, geom, props)
         SELECT ${target}, geom, props FROM (${sql}) r
         WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)`,
        [...args, layer.id],
      );
      if (!rowCount) throw new BadRequestException('That produced no features.');
      return layer;
    });
  }
}

// Only layers in the tool's own map can be picked.
async function loadLayer(db: Db, mapId: number, id: unknown, label: string, shapes: string[]): Promise<LayerRow> {
  const { rows: [layer] } = await db.query<LayerRow>('SELECT * FROM layers WHERE id = $1 AND map_id = $2', [parseId(id), mapId]);
  if (!layer) throw new BadRequestException(`Pick a layer for "${label}".`);
  if (!shapes.includes(layer.shape)) throw new BadRequestException(`"${layer.name}" must be a ${shapes.join(' or ')} layer.`);
  return layer;
}
