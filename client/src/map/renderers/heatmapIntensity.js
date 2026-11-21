// Keeping a heatmap from turning solid red when zoomed out.
//
// MapLibre draws each point as a bell curve: at a distance d pixels from the
// point it adds weight × intensity × 0.3989 × exp(-4.5 (d / radius)²) to the
// density, which the heatmap's colours run across from 0 to 1. Summed over
// the screen, one point adds about 0.2785 × radius² × weight × intensity.
// Every zoom level out shrinks the layer's area on screen to a quarter, so
// the same points pile up four times as densely, and a fixed intensity that
// looks right close up saturates when zoomed out.
//
// So the intensity follows the zoom: at each zoom level it's set for the
// average density over the layer's points to be TARGET_DENSITY times the
// user's intensity (so the slider still brightens or dims the heatmap),
// until that's the intensity the user chose; from there on in, the points
// are far enough apart to be drawn as the user set them. The points' area is their
// extent widened by a point's own footprint, as a layer whose extent is
// smaller than one point (zoomed far out, or all in one place) still spreads
// over that much. Zoomed in, where the extent is far bigger than a point,
// this is a quarter of the intensity for each level out.

// From MapLibre's heatmap shader: the bell curve's peak, and the area under it
// for a radius of one pixel (0.3989 × 2π / 9).
const GAUSS_COEF = 0.3989422804014327;
const KERNEL_AREA = (GAUSS_COEF * 2 * Math.PI) / 9;

// MapLibre leaves out any part of a point whose density would be below this,
// as too faint to count; a point whose peak is below it isn't drawn at all.
const CUTOFF = 1 / 255 / 16;

// The lowest intensity used, so a point's peak is four times the cutoff and
// it's drawn out to about half its radius. Without it, a crowded layer seen
// from far out would vanish; with it, it's a small, dense blob.
const MIN_INTENSITY = (4 * CUTOFF) / GAUSS_COEF;

// The side of the square a point's density would fill at its peak height,
// for a radius of one pixel: its footprint. So points all in one place peak
// at exactly TARGET_DENSITY at an intensity of 1.
const KERNEL_SIDE = Math.sqrt(KERNEL_AREA / GAUSS_COEF);

/** The average density aimed for when zoomed out, at an intensity of 1, on the heatmap's scale of 0 to 1. */
export const TARGET_DENSITY = 0.1;

// The width of the whole world in pixels at zoom 0, in MapLibre.
const WORLD_SIZE = 512;

// The deepest zoom the intensity is still worked out for.
const MAX_ZOOM = 22;

// Web Mercator can't show the poles; MapLibre stops at this latitude.
const MAX_LATITUDE = 85.0511287798066;

/**
 * The heatmap's intensity: the user's `intensity`, lowered at zoom levels
 * where the layer's points would otherwise pile up past TARGET_DENSITY on
 * average, as a MapLibre zoom expression. Just `intensity` if the layer's
 * points are never that crowded, or it has none.
 *
 * Points bunched in one part of their extent are still denser there than
 * the average, which is what a heatmap is for, and a weighted heatmap's
 * points count for less, so it comes out paler. The intensity never goes
 * below MIN_INTENSITY, so very crowded points seen from far out can still
 * be denser than the target.
 *
 * @param {{ radius: number, intensity: number }} symbology the heatmap's settings
 * @param {number} count how many points the layer shows
 * @param {[number, number, number, number] | null} extent the box around them,
 *   `[west, south, east, north]` in degrees
 */
export function heatmapIntensity({ radius, intensity }, count, extent) {
  if (!count || !extent) return intensity;
  const [width, height] = worldSize(extent);
  const footprint = KERNEL_SIDE * radius;
  // A stop at each whole zoom level, from 0 until the full intensity.
  const stops = [];
  for (let zoom = 0; zoom <= MAX_ZOOM; zoom++) {
    const scale = 2 ** zoom;
    const area = (width * scale + footprint) * (height * scale + footprint);
    const share = Math.min(1, (TARGET_DENSITY * area) / (count * KERNEL_AREA * radius ** 2));
    stops.push(zoom, Math.min(intensity, Math.max(MIN_INTENSITY, intensity * share)));
    if (share === 1) break;
  }
  if (stops.length === 2 && stops[1] === intensity) return intensity;
  // Between whole levels, the area grows four times a level.
  return ['interpolate', ['exponential', 4], ['zoom'], ...stops];
}

// The width and height of the box on the map at zoom 0, in pixels.
function worldSize([west, south, east, north]) {
  const x = (lng) => ((lng + 180) / 360) * WORLD_SIZE;
  const y = (lat) => {
    const φ = (Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, lat)) * Math.PI) / 180;
    return ((1 - Math.log(Math.tan(Math.PI / 4 + φ / 2)) / Math.PI) / 2) * WORLD_SIZE;
  };
  return [x(east) - x(west), y(south) - y(north)];
}
