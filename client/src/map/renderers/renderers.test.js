// The colour expressions the categories and colour scale renderers build,
// run by MapLibre's own expression engine against sample features.
import { expression } from '@maplibre/maplibre-gl-style-spec';
import { describe, expect, test } from 'vitest';
import { NO_VALUE_COLOR, OTHER_COLOR, RAMPS } from '../../../../shared/colors.js';
import { categoryColor } from './categories.js';
import { scaleColor } from './scale.js';

const COLOR_SPEC = { type: 'color', 'property-type': 'data-driven', expression: { interpolated: true, parameters: ['zoom', 'feature'] } };

// The colour `expr` gives a feature with these properties, as #rrggbb.
function colorOf(expr, properties) {
  const compiled = expression.createExpression(expr, COLOR_SPEC);
  if (compiled.result !== 'success') throw new Error(compiled.value.map((e) => e.message).join('; '));
  // A Color, its channels from 0 to 1 (all these colours are opaque).
  const { r, g, b } = compiled.value.evaluate({ zoom: 0 }, { type: 'Point', properties });
  return `#${[r, g, b].map((n) => Math.round(n * 255).toString(16).padStart(2, '0')).join('')}`;
}

describe('categoryColor', () => {
  const expr = categoryColor({ field: 'k', categories: [
    { value: 'well', color: '#ff0000' }, { value: 3, color: '#00ff00' }, { value: true, color: '#0000ff' },
  ] });

  test('a value in a category gets its colour, compared as text', () => {
    expect(colorOf(expr, { k: 'well' })).toBe('#ff0000');
    expect(colorOf(expr, { k: 3 })).toBe('#00ff00');
    expect(colorOf(expr, { k: '3' })).toBe('#00ff00');
    expect(colorOf(expr, { k: true })).toBe('#0000ff');
  });

  test('any other value is "other", and a missing or null one is "no value"', () => {
    expect(colorOf(expr, { k: 'pump' })).toBe(OTHER_COLOR);
    expect(colorOf(expr, { k: '' })).toBe(OTHER_COLOR);
    expect(colorOf(expr, {})).toBe(NO_VALUE_COLOR);
    expect(colorOf(expr, { k: null })).toBe(NO_VALUE_COLOR);
  });

  test('with no categories, every value is "other"', () => {
    expect(colorOf(categoryColor({ field: 'k', categories: [] }), { k: 'a' })).toBe(OTHER_COLOR);
  });
});

describe('scaleColor', () => {
  const { colors } = RAMPS.blues;
  const expr = scaleColor({ field: 'n', ramp: 'blues', min: 0, max: 8 });

  test('numbers run along the ramp, staying at its ends beyond min and max', () => {
    expect(colorOf(expr, { n: 0 })).toBe(colors[0]);
    expect(colorOf(expr, { n: 4 })).toBe(colors[2]);
    expect(colorOf(expr, { n: 8 })).toBe(colors[4]);
    expect(colorOf(expr, { n: -5 })).toBe(colors[0]);
    expect(colorOf(expr, { n: 99 })).toBe(colors[4]);
  });

  test('anything but a number is "no value"', () => {
    expect(colorOf(expr, { n: '4' })).toBe(NO_VALUE_COLOR);
    expect(colorOf(expr, {})).toBe(NO_VALUE_COLOR);
  });

  test('with min and max the same, every number is the middle colour', () => {
    expect(colorOf(scaleColor({ field: 'n', ramp: 'blues', min: 2, max: 2 }), { n: 2 })).toBe(colors[2]);
  });
});
