// Argument schemas shared by several tools (see registry.js).
import * as z from 'zod';

/** A map's id, as list_maps and create_map give it. */
export const mapId = z.number().int().positive().describe('The map\'s id, from list_maps or create_map.');

/** A layer's id, as get_map gives it. Layer ids are unique across all maps. */
export const layerId = (what = 'The layer') => z.number().int().positive().describe(`${what}: a layer id, from get_map.`);

/** An optional name for a layer a tool makes. */
export const newLayerName = z.string().optional()
  .describe('A name for the new layer. Leave it out to get one made from the inputs, such as "wells buffer".');
