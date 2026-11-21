// Tools for managing layers: renaming and deleting them.
import * as z from 'zod';
import { deleteLayer, getLayer, renameLayer } from '../../layers.js';
import { MAX_LAYER_NAME } from '../../../shared/limits.js';
import { layerId } from '../schemas.js';
import { layerSummary } from '../summaries.js';

export const layerTools = [
  {
    name: 'rename_layer',
    title: 'Rename a layer',
    description: 'Renames a layer. Give results names that say what they show, such as "Broken pumps, 2 km catchments".',
    input: { layer_id: layerId(), name: z.string().describe(`The new name, at most ${MAX_LAYER_NAME} characters.`) },
    run: async ({ layer_id, name }) => ({ layer: layerSummary(await renameLayer(layer_id, name)) }),
  },
  {
    name: 'delete_layer',
    title: 'Delete a layer',
    description: 'Deletes a layer and all its features, for good. Only delete a layer the user asked to delete, or one you made yourself by mistake.',
    input: { layer_id: layerId() },
    destructive: true,
    run: async ({ layer_id }) => {
      const { name } = await getLayer(layer_id);
      await deleteLayer(layer_id);
      return { deleted: { id: layer_id, name } };
    },
  },
];
