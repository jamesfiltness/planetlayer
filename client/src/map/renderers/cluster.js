import { drawShapes } from './shapes.js';

// The font of the count on each cluster. Every base map theme's style has
// it (see mapStyleUrl in settings/theme.js), so its glyphs can be fetched.
const COUNT_FONT = ['Noto Sans Regular'];

// MapLibre marks the features that stand for clusters with a `point_count`.
const IS_CLUSTER = ['has', 'point_count'];

/**
 * The options that make the layer's source group its points into clusters
 * (the `cluster` symbology; see shared/symbology.js). Past zoom level 14
 * points are never grouped, so every one can be seen and clicked.
 */
export const clusterSource = ({ radius }) => ({ cluster: true, clusterRadius: radius, clusterMaxZoom: 14 });

/**
 * Draws each cluster as a circle, growing in steps with how many points it
 * holds and labelled with that number, and each point not in a cluster as
 * a single-colour point would be. Both are in the layer's fill colour.
 */
export function cluster(layer, prefix, source) {
  const { fillColor, fillOpacity, outlineColor, outlineWidth, opacity } = layer.style;
  const [points] = drawShapes(layer, prefix, source, fillColor);
  return [
    { ...points, filter: ['!', IS_CLUSTER] },
    { id: `${prefix}-clusters`, type: 'circle', source, filter: IS_CLUSTER, paint: {
      'circle-color': fillColor, 'circle-opacity': fillOpacity * opacity,
      'circle-radius': ['step', ['get', 'point_count'], 12, 10, 16, 100, 22, 1000, 28],
      'circle-stroke-color': outlineColor, 'circle-stroke-width': outlineWidth, 'circle-stroke-opacity': opacity } },
    { id: `${prefix}-counts`, type: 'symbol', source, filter: IS_CLUSTER,
      layout: {
        'text-field': ['get', 'point_count_abbreviated'], 'text-font': COUNT_FONT, 'text-size': 12,
        'text-allow-overlap': true, 'text-ignore-placement': true,
      },
      paint: { 'text-color': textOn(fillColor), 'text-opacity': opacity } },
  ];
}

/**
 * Black or white, whichever reads better on `hex`: black on colours that
 * are light by WCAG's relative luminance, white on the rest.
 */
export function textOn(hex) {
  const linear = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  // Where black and white have the same contrast ratio with the colour.
  return luminance > 0.179 ? '#000000' : '#ffffff';
}
