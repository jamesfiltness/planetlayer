// The heatmap's intensity at each zoom, run by MapLibre's expression engine.
import { expression } from '@maplibre/maplibre-gl-style-spec';
import { describe, expect, test } from 'vitest';
import { heatmapIntensity, TARGET_DENSITY } from './heatmapIntensity.js';

const SPEC = { type: 'number', 'property-type': 'data-constant', expression: { interpolated: true, parameters: ['zoom'] } };

// The intensity `value` (a number or zoom expression) gives at `zoom`.
function at(value, zoom) {
  if (typeof value === 'number') return value;
  const compiled = expression.createExpression(value, SPEC);
  if (compiled.result !== 'success') throw new Error(compiled.value.map((e) => e.message).join('; '));
  return compiled.value.evaluate({ zoom });
}

const HEATMAP = { radius: 20, intensity: 2 };
// About the size of a small country near the equator.
const COUNTRY = [30, 0, 31, 1];

describe('heatmapIntensity', () => {
  test("crowded points get a quarter of the intensity for each zoom level out, up to the user's", () => {
    const value = heatmapIntensity(HEATMAP, 100000, COUNTRY);
    expect(at(value, 9) / at(value, 10)).toBeCloseTo(1 / 4, 1);
    expect(at(value, 10)).toBeLessThan(HEATMAP.intensity);
    expect(at(value, 22)).toBe(HEATMAP.intensity);
    for (let zoom = 0; zoom < 22; zoom += 0.5) expect(at(value, zoom + 0.5)).toBeGreaterThanOrEqual(at(value, zoom));
  });

  test('more points, or a wider radius, mean less intensity when zoomed out', () => {
    const base = at(heatmapIntensity(HEATMAP, 10000, COUNTRY), 8);
    expect(at(heatmapIntensity(HEATMAP, 40000, COUNTRY), 8)).toBeCloseTo(base / 4);
    expect(at(heatmapIntensity({ ...HEATMAP, radius: 40 }, 10000, COUNTRY), 8)).toBeLessThan(base / 2);
  });

  test("points spread thinly keep the user's intensity at every zoom", () => {
    expect(heatmapIntensity(HEATMAP, 50, [-170, -60, 170, 70])).toBe(HEATMAP.intensity);
  });

  test("points all in one place peak at the target density times the user's intensity, at any zoom", () => {
    const value = heatmapIntensity(HEATMAP, 100, [10, 10, 10, 10]);
    const peak = (zoom) => 100 * 0.3989422804014327 * at(value, zoom);
    expect(peak(0)).toBeCloseTo(TARGET_DENSITY * HEATMAP.intensity);
    expect(peak(15)).toBeCloseTo(TARGET_DENSITY * HEATMAP.intensity);
  });

  test('the intensity never drops so low that MapLibre stops drawing the points', () => {
    const value = heatmapIntensity(HEATMAP, 1000000, COUNTRY);
    // A point's peak must stay well above MapLibre's cutoff of 1/255/16.
    expect(at(value, 0) * 0.3989422804014327).toBeGreaterThanOrEqual((4 / 255 / 16) * 0.999);
  });

  test('a layer with no points keeps the intensity', () => {
    expect(heatmapIntensity(HEATMAP, 0, null)).toBe(HEATMAP.intensity);
  });
});
