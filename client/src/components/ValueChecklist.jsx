import { useState } from 'react';
import { FIELD } from './fieldClass.js';


/**
 * The value picker for "is one of": a box to search the property's common
 * values (or add one that isn't listed, with Enter) above a checklist of
 * them, each with how many features have it.
 *
 * @param {object} props
 * @param {{ values: Array<{ value: unknown, count: number }> } | undefined} props.field the property's summary
 * @param {boolean} props.numeric whether the values are numbers rather than text
 * @param {Array<string | number>} props.value the values picked
 * @param {(value: Array<string | number>) => void} props.onChange
 */
export default function ValueChecklist({ field, numeric, value, onChange }) {
  const [search, setSearch] = useState('');
  const counts = new Map();
  for (const { value: v, count } of field?.values ?? []) {
    if (numeric ? typeof v === 'number' : typeof v !== 'object') counts.set(numeric ? v : String(v), count);
  }
  // Picked values stay listed even when they aren't among the common ones.
  for (const v of value) if (!counts.has(v)) counts.set(v, null);

  const needle = search.trim().toLowerCase();
  const shown = [...counts].filter(([v]) => String(v).toLowerCase().includes(needle));
  const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  const add = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const typed = search.trim();
    const v = numeric ? Number(typed) : typed;
    if (!typed || (numeric && !Number.isFinite(v))) return;
    if (!value.includes(v)) onChange([...value, v]);
    setSearch('');
  };

  return (
    <div className="flex flex-col gap-1">
      <input
        className={FIELD}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={add}
        placeholder="Find, or type a value and press Enter"
        aria-label="Find or add a value"
      />
      <ul className="max-h-40 overflow-auto rounded-md border border-hairline py-1">
        {shown.map(([v, count]) => (
          <li key={`${typeof v}:${v}`}>
            <label className="flex cursor-pointer items-center gap-2 px-2 py-0.5 hover:bg-hover">
              <input type="checkbox" checked={value.includes(v)} onChange={() => toggle(v)} className="accent-accent" />
              <span className="min-w-0 flex-1 truncate" title={String(v)}>{String(v)}</span>
              {count !== null && <span className="text-xs text-ink-faint">{count}</span>}
            </label>
          </li>
        ))}
        {!shown.length && <li className="px-2 py-0.5 text-ink-faint">{needle ? 'Press Enter to add it' : 'No values listed'}</li>}
      </ul>
      <span className="text-xs text-ink-faint">{value.length} picked</span>
    </div>
  );
}
