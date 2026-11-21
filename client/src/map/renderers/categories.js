import { NO_VALUE_COLOR, OTHER_COLOR } from '../../../../shared/colors.js';
import { categoryKey } from '../../../../shared/symbology.js';
import { drawShapes, ifNoValue } from './shapes.js';

/**
 * Colours each feature by which category its value is in (the `categories`
 * symbology; see shared/symbology.js). Values are compared as text, so a
 * property holding numbers, true or false, or a mix of types works alike.
 */
export function categories(layer, prefix, source) {
  return drawShapes(layer, prefix, source, categoryColor(layer.style.symbology));
}

/** The expression that picks a feature's colour; exported for tests. */
export function categoryColor({ field, categories: list }) {
  // `match` needs at least one value to compare against.
  const pick = list.length
    ? ['match', ['to-string', ['get', field]], ...list.flatMap(({ value, color }) => [categoryKey(value), color]), OTHER_COLOR]
    : OTHER_COLOR;
  return ifNoValue(field, NO_VALUE_COLOR, pick);
}
