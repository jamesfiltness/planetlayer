export const SOURCE_PREFIX = 'layer-';

export const sourceId = (layerId) => `${SOURCE_PREFIX}${layerId}`;

/**
 * The MapLibre layers that draw one of our layers in its style. Points are
 * circles and areas are a fill with a line on top; a line layer has no fill,
 * so only its outline colour and width are used. The overall opacity
 * multiplies the fill's own.
 */
export function mapLayers({ id, shape, style }) {
  const source = sourceId(id);
  const { fillColor, fillOpacity, outlineColor, outlineWidth, opacity } = style;
  if (shape === 'point') {
    return [{ id: `${source}-circle`, type: 'circle', source, paint: {
      'circle-color': fillColor, 'circle-opacity': fillOpacity * opacity, 'circle-radius': 6,
      'circle-stroke-color': outlineColor, 'circle-stroke-width': outlineWidth, 'circle-stroke-opacity': opacity } }];
  }
  const line = { id: `${source}-line`, type: 'line', source, paint: {
    'line-color': outlineColor, 'line-width': outlineWidth, 'line-opacity': opacity } };
  if (shape === 'line') return [line];
  return [
    { id: `${source}-fill`, type: 'fill', source, paint: { 'fill-color': fillColor, 'fill-opacity': fillOpacity * opacity } },
    line,
  ];
}

// The colour that stands for a layer in lists: its fill, or a line's own colour.
export const layerColor = ({ shape, style }) => (shape === 'line' ? style.outlineColor : style.fillColor);
