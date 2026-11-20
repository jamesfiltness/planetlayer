import { useId } from 'react';
import { filterOp } from '../../../shared/filter.js';
import NumberInput from './NumberInput.jsx';
import ValueChecklist from './ValueChecklist.jsx';

const FIELD = 'rounded-md border border-gray-300 px-2 py-1.5';

/**
 * Whether a condition on this property, with this operator, takes numbers.
 * Number-only operators always do; "is" and "is one of" do when the property
 * holds only numbers.
 */
export const takesNumbers = (op, field) =>
  op.accepts.length === 1 && op.accepts[0] === 'number' ? true : op.accepts.includes('number') && field?.type === 'number';

/**
 * The value part of a filter condition, shaped by its operator: nothing for
 * "is empty", a number or text box (suggesting the property's common values)
 * or a true/false choice for one value, two number boxes for a range, and a
 * checklist for "is one of".
 *
 * Key it on the property and operator, so its inputs start afresh when
 * either changes.
 *
 * @param {object} props
 * @param {string} props.op the operator's id (see FILTER_OPS)
 * @param {object | undefined} props.field the property's summary, from useFieldSummaries
 * @param {unknown} props.value
 * @param {(value: unknown) => void} props.onChange
 */
export default function FilterValueInput({ op: opId, field, value, onChange }) {
  const listId = useId();
  const op = filterOp(opId);
  const numeric = takesNumbers(op, field);

  switch (op.value) {
    case 'none':
      return null;
    case 'two':
      return (
        <div className="flex items-center gap-1.5">
          <NumberInput className={`${FIELD} flex-1`} value={value[0]} onChange={(v) => onChange([v, value[1]])} aria-label="From" />
          <span className="text-gray-500">and</span>
          <NumberInput className={`${FIELD} flex-1`} value={value[1]} onChange={(v) => onChange([value[0], v])} aria-label="To" />
        </div>
      );
    case 'many':
      return <ValueChecklist field={field} numeric={numeric} value={value} onChange={onChange} />;
  }

  if (numeric) {
    const range = field?.min !== null && field?.min !== undefined ? `${field.min} to ${field.max}` : 'A number';
    return <NumberInput className={FIELD} value={value} onChange={onChange} placeholder={range} aria-label="Value" />;
  }
  if (field?.type === 'boolean' && op.accepts.includes('boolean')) {
    return (
      <select className={FIELD} value={String(value)} onChange={(e) => onChange(e.target.value === '' ? '' : e.target.value === 'true')} aria-label="Value">
        <option value="" disabled>Choose…</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }
  return (
    <>
      <input className={FIELD} value={value} onChange={(e) => onChange(e.target.value)} list={listId} placeholder="Value" aria-label="Value" />
      <datalist id={listId}>
        {(field?.values ?? []).map(({ value: v }) => <option key={`${typeof v}:${v}`} value={String(v)} />)}
      </datalist>
    </>
  );
}
