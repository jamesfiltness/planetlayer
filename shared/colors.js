// The colours symbology draws with, used by both the server (which checks a
// saved ramp's name) and the client (which assigns and draws the colours).

/**
 * The colours given to categories, most common value first. The first 12
 * are strong, clearly different hues, so the values that cover most features
 * are easiest to tell apart. The next 12 are lighter tones of the same hues,
 * in the same order. Greys are left out: they stand for "other" and "no value".
 */
export const CATEGORY_PALETTE = [
  '#4e79a7', '#f28e2b', '#59a14f', '#e15759', '#b07aa1', '#17becf',
  '#b6992d', '#d37295', '#9d7660', '#499894', '#bcbd22', '#5b4bb7',
  '#a0cbe8', '#ffbe7d', '#8cd17d', '#ff9d9a', '#d4a6c8', '#9edae5',
  '#f1ce63', '#fabfd2', '#d7b5a6', '#86bcb6', '#dbdb8d', '#a99be0',
];

/** Features whose value isn't one of the layer's categories. */
export const OTHER_COLOR = '#a5a5a5';

/** Features that don't have the property, or have it as null. */
export const NO_VALUE_COLOR = '#d9d9d9';

/**
 * The colour ramps a colour scale can use, each running from the lowest
 * value to the highest, with its colours evenly spaced along the way.
 * Viridis and magma are from matplotlib; the rest are from ColorBrewer.
 */
export const RAMPS = {
  viridis: { label: 'Viridis', colors: ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'] },
  magma: { label: 'Magma', colors: ['#000004', '#51127c', '#b73779', '#fc8961', '#fcfdbf'] },
  blues: { label: 'Blues', colors: ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c'] },
  greens: { label: 'Greens', colors: ['#edf8e9', '#bae4b3', '#74c476', '#31a354', '#006d2c'] },
  reds: { label: 'Reds', colors: ['#fee5d9', '#fcae91', '#fb6a4a', '#de2d26', '#a50f15'] },
  redBlue: { label: 'Red to blue', colors: ['#d7191c', '#fdae61', '#ffffbf', '#abd9e9', '#2c7bb6'] },
};

/** The ramp a new colour scale starts with. */
export const DEFAULT_RAMP = 'viridis';
