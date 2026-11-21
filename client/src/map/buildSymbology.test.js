import { describe, expect, test } from 'vitest';
import { CATEGORY_PALETTE, DEFAULT_RAMP } from '../../../shared/colors.js';
import { DEFAULT_CLUSTER_RADIUS, DEFAULT_HEATMAP, DEFAULT_SIZES } from '../../../shared/symbology.js';
import { buildSymbology, startingField } from '../../../shared/buildSymbology.js';

const summary = (name, type, values, extra = {}) =>
  ({ name, type, min: null, max: null, distinct: values.length, values: values.map((value) => ({ value, count: 1 })), ...extra });

describe('buildSymbology', () => {
  test('categories are the most common values, coloured in palette order', () => {
    const field = summary('kind', 'string', ['well', 'pump', 'tap']);
    expect(buildSymbology('categories', field, { type: 'single' })).toEqual({
      type: 'categories', field: 'kind',
      categories: [{ value: 'well', color: CATEGORY_PALETTE[0] }, { value: 'pump', color: CATEGORY_PALETTE[1] }, { value: 'tap', color: CATEGORY_PALETTE[2] }],
    });
  });

  test('there are at most 24 categories, skipping values too long or the same as text', () => {
    const values = [true, 'true', 'x'.repeat(201), ...Array.from({ length: 30 }, (_, i) => `v${i}`)];
    const { categories } = buildSymbology('categories', summary('k', 'mixed', values), { type: 'single' });
    expect(categories).toHaveLength(24);
    expect(categories[0]).toEqual({ value: true, color: CATEGORY_PALETTE[0] });
    expect(categories[1]).toEqual({ value: 'v0', color: CATEGORY_PALETTE[1] });
    expect(new Set(categories.map((c) => c.color)).size).toBe(24);
  });

  test("a colour scale spans the property's range, keeping a previous scale's ramp", () => {
    const field = summary('depth', 'number', [1, 9], { min: 1, max: 9 });
    expect(buildSymbology('scale', field, { type: 'single' })).toEqual({ type: 'scale', field: 'depth', ramp: DEFAULT_RAMP, min: 1, max: 9 });
    expect(buildSymbology('scale', field, { type: 'scale', ramp: 'reds' }).ramp).toBe('reds');
  });

  test("sizes span the property's range, keeping a previous size style's sizes", () => {
    const field = summary('depth', 'number', [1, 9], { min: 1, max: 9 });
    expect(buildSymbology('size', field, { type: 'single' })).toEqual({ type: 'size', field: 'depth', min: 1, max: 9, ...DEFAULT_SIZES });
    expect(buildSymbology('size', field, { type: 'size', minSize: 5, maxSize: 30 })).toMatchObject({ minSize: 5, maxSize: 30 });
  });

  test('a heatmap is weighted by a property or by nothing, keeping its settings', () => {
    const field = summary('depth', 'number', [1, 9], { min: 1, max: 9 });
    expect(buildSymbology('heatmap', undefined, { type: 'single' })).toEqual({ type: 'heatmap', field: null, ...DEFAULT_HEATMAP });
    const previous = { type: 'heatmap', field: null, radius: 40, intensity: 2 };
    expect(buildSymbology('heatmap', field, previous)).toEqual({ type: 'heatmap', field: 'depth', min: 1, max: 9, radius: 40, intensity: 2 });
  });

  test('a cluster style keeps its radius', () => {
    expect(buildSymbology('cluster', undefined, { type: 'single' })).toEqual({ type: 'cluster', radius: DEFAULT_CLUSTER_RADIUS });
    expect(buildSymbology('cluster', undefined, { type: 'cluster', radius: 70 }).radius).toBe(70);
  });
});

describe('startingField', () => {
  const fields = [
    summary('code', 'string', Array.from({ length: 50 }, (_, i) => `c${i}`)),
    summary('depth', 'number', [1, 2, 3], { min: 1, max: 3 }),
    summary('kind', 'string', ['well', 'pump']),
  ];

  test('prefers a property with few enough values to all be categories', () => {
    expect(startingField('categories', fields).name).toBe('depth');
    expect(startingField('scale', fields).name).toBe('depth');
    expect(startingField('categories', fields.slice(0, 1)).name).toBe('code');
  });

  test('is undefined when nothing fits, or the type needs no property or starts without one', () => {
    expect(startingField('scale', [fields[0]])).toBeUndefined();
    expect(startingField('single', fields)).toBeUndefined();
    expect(startingField('heatmap', fields)).toBeUndefined();
  });
});
