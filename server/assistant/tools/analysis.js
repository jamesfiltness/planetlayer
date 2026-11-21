// The analysis tools, one per tool in TOOLS (shared/spec.js), so a tool
// added there is offered to assistants too. Each runs runTool (tools.js),
// as the app's Analyse menu does, and makes a new layer in the same map.
import * as z from 'zod';
import { getLayer } from '../../layers.js';
import { runTool } from '../../tools.js';
import { TOOLS } from '../../../shared/spec.js';
import { layerId, newLayerName } from '../schemas.js';
import { newLayerSummary } from '../summaries.js';

// What each tool does, for the model, beyond the spec's one-line hint:
// mostly what the new layer's features are and which properties they get.
const DETAILS = {
  buffer: 'Each feature becomes the area within the distance of it, keeping its properties. '
    + 'With merge, overlapping areas join into one and lose their properties. A negative distance shrinks areas.',
  intersect: 'The part of each feature inside the areas, with the properties of both. A feature crossing two areas becomes two.',
  subtract: 'The part of each feature outside all the areas, keeping its own properties. Features entirely inside are dropped.',
  dissolve: 'Shapes sharing the property\'s value merge into one, with that value and a `count` of how many merged. '
    + 'Without a property, everything merges into one.',
  summarize: 'Each area gets `count`, the number of features in it, and, given a property, `<property>_<stat>` such as `pop_est_sum`. '
    + 'A point counts for every area it touches; a line or area counts once, in the area holding its centre. '
    + 'Only values stored as numbers are added up. Areas keep their own properties.',
  centroid: 'Each shape becomes a point at its centre (or on it, if the centre falls outside), keeping its properties.',
  combine: 'All the features of both layers in one layer, keeping their properties.',
};

/** The zod schema for one of a tool's fields (see TOOLS in shared/spec.js). */
function fieldSchema(field) {
  if (field.shapes) return layerId(`${field.label}: a ${field.shapes.join(', ')} layer`);
  if (field.sameShapeAs) return layerId(`${field.label}: a layer of the same shape as ${field.sameShapeAs}`);
  if (field.fieldOf) {
    return z.string().optional().describe(`${field.label}: a property of ${field.fieldOf}. Leave it out for ${field.none ?? 'everything'}.`);
  }
  const schema = field.options ? z.enum(field.options) : field.type === 'checkbox' ? z.boolean() : z.number();
  const initial = field.initial === undefined ? '' : ` Default ${field.initial}.`;
  const needs = field.needs ? ` Only used with ${field.needs}.` : '';
  return (field.initial === undefined ? schema : schema.optional()).describe(`${field.label}.${initial}${needs}`);
}

export const analysisTools = TOOLS.map((tool) => ({
  name: tool.id,
  title: tool.label,
  description: `${tool.hint}, as a new layer in the same map. ${DETAILS[tool.id] ?? ''} `
    + 'Only the features each layer\'s filter lets through are used. All layers must be in the same map.',
  input: {
    ...Object.fromEntries(tool.fields.map((field) => [field.key, fieldSchema(field)])),
    name: newLayerName,
  },
  run: async (args) => {
    const params = { ...args };
    for (const field of tool.fields) {
      if (params[field.key] === undefined && field.initial !== undefined) params[field.key] = field.initial;
    }
    // The tool runs in the map of the first layer picked; runTool refuses
    // layers from any other map.
    const first = tool.fields.find((field) => field.shapes);
    const { map_id } = await getLayer(params[first.key]);
    return { layer: await newLayerSummary(await runTool(map_id, tool.id, params)) };
  },
}));
