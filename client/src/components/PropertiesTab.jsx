import { useState } from 'react';
import Button from './Button.jsx';
import { PlusIcon } from './icons.jsx';
import PropertyEditor from './PropertyEditor.jsx';

const TYPE_LABELS = { number: 'number', string: 'text', boolean: 'true/false', object: 'object', list: 'list', mixed: 'mixed' };

// Objects and lists can't be worked out from an expression, so they aren't
// offered for recalculating, which would replace them.
const RECALCULABLE = new Set(['number', 'string', 'boolean', 'mixed']);

// The editor open for adding a property, rather than recalculating one.
const ADDING = Symbol('adding');

// A property's most common value, as a short sample of what it holds.
const sample = (field) => {
  const value = field.values[0]?.value;
  return value === undefined ? '' : typeof value === 'string' ? `"${value}"` : String(value);
};

/**
 * The layer editor's Properties tab: each property of the layer's features
 * with its type and a sample value, a Recalculate button on each that opens
 * a PropertyEditor under it, and Add a property at the foot. Both set the
 * property on every feature, in place.
 *
 * Key it on the layer's id, so another layer starts afresh.
 *
 * @param {object} props
 * @param {{ fields: object[] | null, error: string | null }} props.summaries the layer's properties, from useFieldSummaries
 * @param {(name: string, expression: string) => Promise<{ name: string, numbers: number, empty: number }>} props.onCalculate
 */
export default function PropertiesTab({ summaries, onCalculate }) {
  const { fields, error } = summaries;
  const [editing, setEditing] = useState(null); // a property's name, ADDING, or null
  const [done, setDone] = useState(null); // { name, message }: what the last change did; name is null for an added one

  const editor = (name, type) => (
    <PropertyEditor
      name={name}
      type={type}
      names={fields.map((f) => f.name)}
      onCalculate={onCalculate}
      onDone={(message) => {
        setDone({ name, message });
        setEditing(null);
      }}
      onCancel={() => setEditing(null)}
    />
  );

  if (error) return <p className="text-danger-text">Couldn't read the layer's properties: {error}</p>;
  if (!fields) return <p className="text-ink-faint">Reading the layer's properties…</p>;

  return (
    <div className="flex flex-col gap-3">
      {fields.length ? (
        <ul className="flex flex-col divide-y divide-hairline">
          {fields.map((f) => (
            <li key={f.name} className="flex flex-col gap-1.5 py-1.5">
              <div className="flex items-center gap-2">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium" title={f.name}>{f.name}</span>
                  <span className="truncate text-ink-faint" title={sample(f)}>
                    {TYPE_LABELS[f.type]}{sample(f) && `, such as ${sample(f)}`}
                  </span>
                </div>
                {RECALCULABLE.has(f.type) && editing !== f.name && (
                  <Button className="flex-none border border-edge px-2 py-1" aria-label={`Recalculate ${f.name}`} onClick={() => setEditing(f.name)}>
                    Recalculate
                  </Button>
                )}
              </div>
              {editing === f.name && editor(f.name, f.type)}
              {done?.name === f.name && editing !== f.name && <p className="text-ink-faint" role="status">{done.message}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-faint">This layer's features have no properties yet.</p>
      )}

      {editing === ADDING ? editor(null) : (
        <Button className="self-start border border-edge" onClick={() => setEditing(ADDING)}>
          <PlusIcon /> Add a property
        </Button>
      )}
      {done?.name === null && editing !== ADDING && <p className="text-ink-faint" role="status">{done.message}</p>}
    </div>
  );
}
