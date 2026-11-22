// Tools for layer filters: showing only the features that match, and saving
// those as a layer of their own. Filters are described in shared/filter.js.
import * as z from 'zod';
import { saveFilteredAsLayer, saveLayerFilter } from '../../layerFilter.js';
import { getLayer } from '../../layers.js';
import { FILTER_MATCHES, FILTER_OPS, MAX_FILTER_CONDITIONS } from '../../../shared/filter.js';
import { layerId, newLayerName } from '../schemas.js';
import { layerSummary, newLayerSummary } from '../summaries.js';

const OPS = FILTER_OPS.map((op) => `${op.id} (${op.label})`).join(', ');

const filter = z.object({
  match: z.enum(FILTER_MATCHES).optional().describe('all (default): a feature must pass every condition; any: one is enough.'),
  conditions: z.array(z.object({
    field: z.string().describe('A property name, as describe_layer gives it.'),
    op: z.enum(FILTER_OPS.map((op) => op.id)),
    value: z.unknown().optional().describe('One value; [low, high] for between; a list for in and not_in; none for empty and not_empty.'),
  })).max(MAX_FILTER_CONDITIONS),
}).describe(
  `Conditions on the features' properties. Operators: ${OPS}. `
  + 'Text comparisons ignore case. The number operators only match values stored as numbers. '
  + 'is, is not, is one of and is not one of compare by the type of the value given, so 3 and "3" differ.',
);

export const filterTools = [
  {
    name: 'set_layer_filter',
    title: 'Filter a layer',
    description:
      'Sets a layer\'s filter, so the map shows only the features that match, and the analysis tools use only those. '
      + 'Pass null to remove it. This replaces any filter the layer had, and the user sees it in the layer\'s Filter tab. '
      + 'To keep the matching features as a layer of their own, use save_filtered_layer instead.',
    input: { layer_id: layerId(), filter: filter.nullable() },
    run: async ({ layer_id, filter: value }) => {
      await saveLayerFilter(layer_id, value);
      return { layer: layerSummary(await getLayer(layer_id)) };
    },
  },
  {
    name: 'save_filtered_layer',
    title: 'Save matching features as a layer',
    description:
      'Copies the features of a layer that match a filter into a new layer in the same map, leaving the original as it was. '
      + 'Use it to split a layer, such as broken pumps from working ones.',
    input: { layer_id: layerId('The layer to copy from'), filter, name: newLayerName },
    run: async ({ layer_id, filter: value, name }) => ({ layer: await newLayerSummary(await saveFilteredAsLayer(layer_id, { filter: value, name })) }),
  },
];
