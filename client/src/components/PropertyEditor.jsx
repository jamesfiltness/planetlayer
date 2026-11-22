import { useState } from 'react';
import { ExpressionError, MAX_EXPRESSION, parseExpression, propertyReference } from '../../../shared/expression.js';
import { MAX_PROPERTY_NAME } from '../../../shared/limits.js';
import Button from './Button.jsx';
import { FIELD } from './fieldClass.js';

// A count of features, in full in the reader's number format.
const count = (n) => n.toLocaleString();

// What's wrong with the expression, checked as it's typed, or null.
function problem(expression) {
  if (!expression.trim()) return null;
  try {
    parseExpression(expression);
    return null;
  } catch (e) {
    if (e instanceof ExpressionError) return e.message;
    throw e;
  }
}

/**
 * The small form the Properties tab opens to set a property on every
 * feature from an expression (see shared/expression.js for the language):
 * under a property's row to recalculate it, or at the foot of the tab, with
 * a name box, to add one. Mistakes in the expression are pointed out as it's
 * typed; the server checks the property names.
 *
 * For a property holding text, a shortcut fills in `number(<property>)`,
 * which turns numbers written as text into numbers.
 *
 * @param {object} props
 * @param {string | null} props.name the property to recalculate, or null to add one
 * @param {string} [props.type] its type, from its summary
 * @param {string[]} props.names the layer's property names, suggested when adding one
 * @param {(name: string, expression: string) => Promise<{ name: string, numbers: number, empty: number }>} props.onCalculate
 *   throws if it fails, with a message to show
 * @param {(message: string) => void} props.onDone called with what was done, once it worked
 * @param {() => void} props.onCancel
 */
export default function PropertyEditor({ name, type, names, onCalculate, onDone, onCancel }) {
  const adding = name === null;
  const [newName, setNewName] = useState('');
  const [expression, setExpression] = useState(adding ? '' : propertyReference(name));
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const mistake = problem(expression);
  const toNumber = !adding && (type === 'string' || type === 'mixed') && `number(${propertyReference(name)})`;

  const submit = async (e) => {
    e.preventDefault();
    setRunning(true);
    setError(null);
    try {
      const { name: saved, numbers, empty } = await onCalculate(adding ? newName.trim() : name, expression);
      const left = empty ? ` ${count(empty)} left empty, where a value it needs is missing, isn't a number, or is divided by zero.` : '';
      onDone(`Set "${saved}" on ${count(numbers + empty)} ${numbers + empty === 1 ? 'feature' : 'features'}.${left}`);
    } catch (failure) {
      setError(failure.message);
      setRunning(false);
    }
  };

  return (
    <form className="flex flex-col gap-2 rounded-lg border border-hairline p-2" onSubmit={submit}>
      {adding && (
        <label className="flex flex-col gap-1">
          <span>New property</span>
          <input className={FIELD} value={newName} maxLength={MAX_PROPERTY_NAME} list="property-names" required autoFocus
            onChange={(e) => setNewName(e.target.value)} placeholder="Such as per_house" />
          <datalist id="property-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
        </label>
      )}
      <label className="flex flex-col gap-1">
        <span>{adding ? 'Expression' : `New value of ${name}`}</span>
        <input className={`${FIELD} font-mono`} value={expression} maxLength={MAX_EXPRESSION} required spellCheck={false} autoFocus={!adding}
          onChange={(e) => setExpression(e.target.value)} placeholder="pop_est / building_count" aria-invalid={Boolean(mistake)} />
      </label>
      {toNumber && expression !== toNumber && (
        <button type="button" className="cursor-pointer self-start text-accent underline" onClick={() => setExpression(toNumber)}>
          Make it numbers: {toNumber}
        </button>
      )}
      {mistake ? (
        <p className="text-danger-text">{mistake}</p>
      ) : (
        <p className="text-ink-faint">
          Use + - * /, brackets, round(x, digits), abs, min, max, and number(property) to read numbers written as text.
          Put a name with spaces in double quotes.
        </p>
      )}
      {error && <p className="text-danger-text" role="alert">{error}</p>}
      <div className="flex justify-end gap-1.5">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={running || Boolean(mistake)}>
          {running ? 'Calculating…' : adding ? 'Add' : 'Recalculate'}
        </Button>
      </div>
    </form>
  );
}
