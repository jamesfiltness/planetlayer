/**
 * Draws every feature alike, in the layer's own colours (the `single`
 * symbology). Points are circles and areas are a fill with a line on top;
 * a line layer has no fill, so only its outline colour and width are used.
 * The overall opacity multiplies the fill's own.
 *
 * @param {{ shape: string, style: object }} layer
 * @param {string} prefix the start of every style layer's id (see renderers/index.js)
 * @param {string} source the id of the source holding the layer's features
 */
export function single({ shape, style }, prefix, source) {
  const { fillColor, fillOpacity, outlineColor, outlineWidth, opacity } = style;
  if (shape === 'point') {
    return [{ id: `${prefix}-circle`, type: 'circle', source, paint: {
      'circle-color': fillColor, 'circle-opacity': fillOpacity * opacity, 'circle-radius': 6,
      'circle-stroke-color': outlineColor, 'circle-stroke-width': outlineWidth, 'circle-stroke-opacity': opacity } }];
  }
  const line = { id: `${prefix}-line`, type: 'line', source, paint: {
    'line-color': outlineColor, 'line-width': outlineWidth, 'line-opacity': opacity } };
  if (shape === 'line') return [line];
  return [
    { id: `${prefix}-fill`, type: 'fill', source, paint: { 'fill-color': fillColor, 'fill-opacity': fillOpacity * opacity } },
    line,
  ];
}
