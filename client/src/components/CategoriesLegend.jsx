import { NO_VALUE_COLOR, OTHER_COLOR } from '../../../shared/colors.js';

// A category's value as the legend shows it.
const describe = (value) => (value === '' ? '(empty text)' : String(value));

/**
 * The colour of each category in a categories style, most common value
 * first, then the colours of values outside them: "any other value" (shown
 * when the property has more values than there are categories, or isn't
 * summarised) and "no value".
 *
 * @param {object} props
 * @param {Array<{ value: string | number | boolean, color: string }>} props.categories
 * @param {{ distinct: number } | undefined} props.field the property's summary, if it has one
 */
export default function CategoriesLegend({ categories, field }) {
  const hasOthers = !field || field.distinct > categories.length;
  return (
    <ul aria-label="Categories" className="flex flex-col gap-1">
      {categories.map(({ value, color }) => <Entry key={`${typeof value}:${value}`} color={color} label={describe(value)} />)}
      {hasOthers && <Entry color={OTHER_COLOR} label="Any other value" faint />}
      <Entry color={NO_VALUE_COLOR} label="No value" faint />
    </ul>
  );
}

function Entry({ color, label, faint = false }) {
  return (
    <li className={`flex items-center gap-2 ${faint ? 'text-ink-faint' : ''}`}>
      <span className="size-3 flex-none rounded-full border border-edge" style={{ backgroundColor: color }} />
      <span className="min-w-0 truncate" title={label}>{label}</span>
    </li>
  );
}
