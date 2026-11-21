/**
 * The style layers that draw a layer's features in `color`: points as
 * circles, lines as lines, and areas as a fill with a line on top.
 *
 * `color` is a colour or a MapLibre expression that works one out per
 * feature. It fills points and areas, and colours a line layer's lines (a
 * line has no fill). An area's outline and a point's ring keep the layer's
 * outline colour. The overall opacity multiplies the fill's own.
 *
 * @param {{ shape: string, style: object }} layer
 * @param {string} prefix the start of every style layer's id (see index.js)
 * @param {string} source the id of the source holding the layer's features
 * @param {string | unknown[]} color
 */
export function drawShapes({ shape, style }, prefix, source, color) {
  const { fillOpacity, outlineColor, outlineWidth, opacity } = style;
  if (shape === 'point') {
    return [{ id: `${prefix}-circle`, type: 'circle', source, paint: {
      'circle-color': color, 'circle-opacity': fillOpacity * opacity, 'circle-radius': 6,
      'circle-stroke-color': outlineColor, 'circle-stroke-width': outlineWidth, 'circle-stroke-opacity': opacity } }];
  }
  const line = (lineColor) => ({ id: `${prefix}-line`, type: 'line', source, paint: {
    'line-color': lineColor, 'line-width': outlineWidth, 'line-opacity': opacity } });
  if (shape === 'line') return [line(color)];
  return [
    { id: `${prefix}-fill`, type: 'fill', source, paint: { 'fill-color': color, 'fill-opacity': fillOpacity * opacity } },
    line(outlineColor),
  ];
}

/**
 * An expression that's `then` for features with no value in `field` (they
 * don't have it, or it's null), and `otherwise` for the rest.
 */
export const ifNoValue = (field, then, otherwise) => ['case', ['==', ['typeof', ['get', field]], 'null'], then, otherwise];
