import { conditionProblem, filterOp, opsForType } from '../../../shared/filter.js';
import FilterValueInput from './FilterValueInput.jsx';
import { CloseIcon } from './icons.jsx';

const FIELD = 'rounded-md border border-edge px-2 py-1.5';

// The value a condition starts with for each shape of value (see FILTER_OPS).
const BLANK = { none: null, one: '', two: ['', ''], many: [] };

// Whether `value` can stay when the operator changes to `op`: it has the same
// shape and the operator accepts it. Otherwise it's cleared.
function fits(value, op) {
  const sample = Array.isArray(value) ? value.find((v) => v !== '') : value;
  return sample === undefined || sample === '' || op.accepts.includes(typeof sample);
}

/**
 * One condition in the Filter tab: which property, how to compare it (only
 * the operators that suit the property's type are offered), and the value.
 * A condition that isn't finished isn't applied until it is, and says
 * what's missing when `showProblem` is set.
 *
 * @param {object} props
 * @param {{ field: string, op: string, value: unknown }} props.condition
 * @param {object[]} props.fields the layer's property summaries, from useFieldSummaries
 * @param {boolean} props.showProblem whether to say what's missing, if anything is
 * @param {(condition: object) => void} props.onChange called with the whole new condition
 * @param {() => void} props.onRemove
 */
export default function ConditionRow({ condition, fields, showProblem, onChange, onRemove }) {
  const field = fields.find((f) => f.name === condition.field);
  const ops = opsForType(field?.type ?? 'string');
  // A saved condition whose property has since changed type keeps its operator.
  if (!ops.some((op) => op.id === condition.op)) ops.unshift(filterOp(condition.op));
  const problem = showProblem ? conditionProblem(condition) : null;

  // A new property keeps the operator if it still suits, else falls back to "is".
  const setField = (name) => {
    const type = fields.find((f) => f.name === name)?.type ?? 'string';
    const keep = opsForType(type).some((op) => op.id === condition.op) && type === field?.type;
    const op = keep ? condition.op : 'eq';
    onChange({ ...condition, field: name, op, value: keep ? condition.value : BLANK[filterOp(op).value] });
  };

  const setOp = (id) => {
    const [before, after] = [filterOp(condition.op), filterOp(id)];
    const keep = before.value === after.value && fits(condition.value, after);
    onChange({ ...condition, op: id, value: keep ? condition.value : BLANK[after.value] });
  };

  return (
    <li className="flex flex-col gap-1.5 rounded-lg border border-hairline p-2">
      <div className="flex items-center gap-1">
        <select className={`${FIELD} min-w-0 flex-1`} value={condition.field} onChange={(e) => setField(e.target.value)} aria-label="Property">
          <option value="" disabled>Choose a property…</option>
          {!field && condition.field && <option value={condition.field}>{condition.field}</option>}
          {fields.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
        </select>
        <button
          type="button"
          title="Remove condition"
          aria-label="Remove condition"
          onClick={onRemove}
          className="flex-none cursor-pointer rounded-lg p-2 text-ink-faint hover:bg-hover hover:text-ink"
        >
          <CloseIcon />
        </button>
      </div>
      {condition.field && (
        <>
          <select className={FIELD} value={condition.op} onChange={(e) => setOp(e.target.value)} aria-label="Comparison">
            {ops.map((op) => <option key={op.id} value={op.id}>{op.label}</option>)}
          </select>
          <FilterValueInput key={`${condition.field}\n${condition.op}`} op={condition.op} field={field} value={condition.value} onChange={(value) => onChange({ ...condition, value })} />
        </>
      )}
      {problem && <p role="alert" className="text-xs text-warning-text">Not applied yet: {problem}</p>}
    </li>
  );
}
