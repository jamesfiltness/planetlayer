// The style_layer tool: how a layer is drawn. Style types are described in
// shared/symbology.js.
//
// A model only has to say which style type and property it wants. The rest
// (which values get which colours, a scale's range) is filled in as the
// Style tab fills it in, from the property's values, and anything the model
// does give replaces that.
import * as z from 'zod';
import { fieldSummaries } from '../../filter/fields.js';
import { getLayer, saveLayerStyle } from '../../layers.js';
import { badRequest } from '../../errors.js';
import { buildSymbology, startingField } from '../../../shared/buildSymbology.js';
import { RAMPS } from '../../../shared/colors.js';
import { STYLE_LIMITS } from '../../../shared/limits.js';
import { SYMBOLOGY_TYPES, symbologyType } from '../../../shared/symbology.js';
import { layerId } from '../schemas.js';
import { layerSummary } from '../summaries.js';

const TYPES = SYMBOLOGY_TYPES.map((t) => t.type);
const color = (what) => z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().describe(`${what}, like #1a2b3c.`);
const between = ([min, max], what) => z.number().min(min).max(max).optional().describe(`${what}, from ${min} to ${max}.`);

const symbology = z.looseObject({
  type: z.enum(TYPES),
  field: z.string().nullable().optional().describe('The property to style by. Left out, the first one that suits the type is used.'),
}).describe(
  'single: every feature in the fill colour. categories: a colour for each of a property\'s most common values (up to 24). '
  + `scale: a colour ramp along a numeric property (ramp: ${Object.keys(RAMPS).join(', ')}). `
  + 'Points only: size (circles sized by a numeric property), heatmap (field optional, as a weight), cluster (nearby points grouped). '
  + 'The colours, range and sizes are worked out from the data; to change them, also pass the keys to replace, '
  + 'such as min and max, ramp, minSize and maxSize, radius, or categories as [{ value, color }].',
);

export const styleTools = [
  {
    name: 'style_layer',
    title: 'Style a layer',
    description:
      'Changes how a layer is drawn: its style type (such as colouring areas by a property, to show a ranking), '
      + 'and its fill colour, outline and opacity. Settings left out stay as they are.',
    input: {
      layer_id: layerId(),
      symbology: symbology.optional(),
      fill_color: color('The fill colour (the line colour for lines)'),
      fill_opacity: between(STYLE_LIMITS.fillOpacity, 'How opaque the fill is'),
      outline_color: color('The outline colour'),
      outline_width: between(STYLE_LIMITS.outlineWidth, 'The outline width in pixels'),
      opacity: between(STYLE_LIMITS.opacity, 'How opaque the whole layer is'),
    },
    run: async ({ layer_id, symbology: wanted, fill_color, fill_opacity, outline_color, outline_width, opacity }) => {
      const layer = await getLayer(layer_id);
      const { style } = layer;
      await saveLayerStyle(layer.id, {
        fillColor: fill_color ?? style.fillColor,
        fillOpacity: fill_opacity ?? style.fillOpacity,
        outlineColor: outline_color ?? style.outlineColor,
        outlineWidth: outline_width ?? style.outlineWidth,
        opacity: opacity ?? style.opacity,
        symbology: wanted ? await completeSymbology(layer, wanted) : style.symbology,
      });
      const saved = await getLayer(layer.id);
      return { layer: layerSummary(saved) };
    },
  },
];

/**
 * The symbology `wanted` asks for, with whatever it leaves out filled in
 * from the layer's data. It's checked when saved (parseSymbology).
 */
async function completeSymbology(layer, wanted) {
  const entry = symbologyType(wanted.type);
  if (!entry.fits) return buildSymbology(wanted.type, undefined, layer.style.symbology);

  const fields = await fieldSummaries(layer.id);
  let field;
  if (typeof wanted.field === 'string') {
    field = fields.find((f) => f.name === wanted.field);
    if (!field) throw badRequest(`"${layer.name}" has no property "${wanted.field}". Use describe_layer to see its properties.`);
    if (!entry.fits(field)) throw badRequest(`"${wanted.field}" doesn't suit a ${entry.label} style. ${fitHint(wanted.type)}`);
  } else if (wanted.field === undefined) {
    field = startingField(wanted.type, fields);
    if (!field && !entry.optionalField) throw badRequest(`${entry.noField} in "${layer.name}", so it can't use a ${entry.label} style.`);
  }
  return { ...buildSymbology(wanted.type, field, layer.style.symbology), ...wanted, field: field?.name ?? null };
}

const fitHint = (type) => (type === 'categories'
  ? 'Categories need text, true/false, or numbers with at most 24 different values.'
  : 'It needs a property that holds numbers.');
