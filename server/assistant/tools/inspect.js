// Tools for reading a layer's data: a summary of its properties, and its
// features a page at a time.
import * as z from 'zod';
import { GEOMETRY_MODES, getFeatures, MAX_PAGE } from '../../features.js';
import { fieldSummaries } from '../../filter/fields.js';
import { getLayer } from '../../layers.js';
import { layerId } from '../schemas.js';
import { layerSummary } from '../summaries.js';

// How many of each property's most common values describe_layer lists.
// fieldSummaries finds up to 100, which is more than a model needs to see
// what a property holds; `distinct` still says how many there are.
const TOP_VALUES = 10;

export const inspectTools = [
  {
    name: 'describe_layer',
    title: 'Describe a layer',
    description:
      'Summarises every property of a layer\'s features: its type (string, number, boolean, object, list or mixed), '
      + 'its range if it holds numbers, how many different values it has and its most common values with their counts. '
      + 'Call this before filtering, styling or adding up a property, to use its real name and values '
      + '(a status might be "broken" or "Non-Functional"). The summary covers every feature, ignoring the layer\'s filter.',
    input: { layer_id: layerId() },
    readOnly: true,
    run: async ({ layer_id }) => {
      const layer = await getLayer(layer_id);
      const properties = (await fieldSummaries(layer.id)).map((field) => ({ ...field, values: field.values.slice(0, TOP_VALUES) }));
      const summary = layerSummary(layer);
      delete summary.fields; // `properties` covers them, in full
      return { layer: summary, properties };
    },
  },
  {
    name: 'get_features',
    title: 'Read features',
    description:
      'Reads a page of a layer\'s features: their ids and properties, and optionally their geometry. '
      + 'Only features the layer\'s filter lets through are included. Sort by a property to find the top or bottom of a ranking, '
      + 'such as the areas with the most people. The result says how many features match in total and where the next page starts. '
      + 'Geometry is left out by default: the analysis tools work on layers in the app, so you rarely need coordinates. '
      + 'Ask for `centroid` to know roughly where each feature is, or `full` for its exact shape (large for areas and lines).',
    input: {
      layer_id: layerId(),
      limit: z.number().int().min(1).max(MAX_PAGE).optional().describe(`Features per page, up to ${MAX_PAGE}. Default 20.`),
      offset: z.number().int().min(0).optional().describe('How many features to skip, from a previous page\'s next_offset. Default 0.'),
      sort_by: z.string().optional().describe('A property to sort by. Features without it come last.'),
      order: z.enum(['asc', 'desc']).optional().describe('Sort direction. Default asc; use desc for the highest first.'),
      geometry: z.enum(GEOMETRY_MODES).optional().describe('none (default), centroid (a point at each feature\'s centre) or full.'),
      properties: z.array(z.string()).optional().describe('Only these properties. Default all.'),
    },
    readOnly: true,
    run: async ({ layer_id, sort_by, ...options }) => ({ layer_id, ...(await getFeatures(layer_id, { ...options, sortBy: sort_by })) }),
  },
];
