import { describe, expect, test } from 'vitest';
import { CATEGORY_PALETTE, DEFAULT_RAMP } from '../../../shared/colors.js';
import { buildSymbology, startingField } from './buildSymbology.js';

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

  test('is undefined when nothing fits, or the type needs no property', () => {
    expect(startingField('scale', [fields[0]])).toBeUndefined();
    expect(startingField('single', fields)).toBeUndefined();
  });
});
