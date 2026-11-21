import { useRef, useState } from 'react';
import { conditionProblem, FILTER_MATCHES, MAX_FILTER_CONDITIONS } from '../../../shared/filter.js';
import { useFieldSummaries } from '../hooks/useFieldSummaries.js';
import Button from './Button.jsx';
import ConditionRow from './ConditionRow.jsx';
import { PlusIcon } from './icons.jsx';
import SaveAsLayerForm from './SaveAsLayerForm.jsx';

const MATCH_LABELS = { all: 'All', any: 'Any' };

let nextKey = 1; // React keys for condition rows, which have no id of their own
const withKey = (condition) => ({ ...condition, key: nextKey++ });

// The filter the finished conditions make, or null if there are none.
// Unfinished ones are left out, so the map never waits on a half-made row.
function toFilter(match, rows) {
  const conditions = rows.filter((row) => !conditionProblem(row)).map(({ field, op, value }) => ({ field, op, value }));
  return conditions.length ? { match, conditions } : null;
}

/**
 * The layer editor's Filter tab: conditions on the features' properties, so
 * the layer shows only the features that match all (or any) of them, and a
 * form to save those features as a new layer. See shared/filter.js for what
 * each comparison means.
 *
 * Its rows are a draft, kept here so unfinished ones survive. Whenever the
 * finished ones add up to a different filter, it's passed to `onChange`.
 * An unfinished row stays quiet while it's being filled in: it only says
 * what's missing once saving as a new layer has been tried with it there.
 * Key it on the layer's id, so another layer starts from its own filter.
 *
 * @param {object} props
 * @param {{ id: number, count: number, matching: number | null, filter: object | null }} props.layer
 *   `matching` is null while a changed filter is being saved
 * @param {(filter: object | null) => void} props.onChange
 * @param {(filter: object, name: string) => Promise<boolean>} props.onSaveAsLayer resolves to whether it worked
 */
export default function FilterTab({ layer, onChange, onSaveAsLayer }) {
  const { fields, error } = useFieldSummaries(layer.id);
  const [match, setMatch] = useState(layer.filter?.match ?? 'all');
  const [rows, setRows] = useState(() => (layer.filter?.conditions ?? []).map(withKey));
  const sent = useRef(JSON.stringify(layer.filter ?? null));
  // Keys of the rows that were unfinished when a save was last tried.
  const [flagged, setFlagged] = useState(() => new Set());
  const filter = toFilter(match, rows);

  const apply = (nextMatch, nextRows) => {
    setMatch(nextMatch);
    setRows(nextRows);
    const next = toFilter(nextMatch, nextRows);
    if (JSON.stringify(next) === sent.current) return;
    sent.current = JSON.stringify(next);
    onChange(next);
  };

  // Saves the matching features as a new layer, unless a row is unfinished:
  // then those rows are flagged to show what's missing, and nothing is saved.
  const save = async (name) => {
    const unfinished = rows.filter(conditionProblem);
    if (!unfinished.length) return onSaveAsLayer(filter, name);
    setFlagged(new Set(unfinished.map((row) => row.key)));
    return false;
  };

  if (error) return <p className="text-danger-text">Couldn't read the layer's properties: {error}</p>;
  if (!fields) return <p className="text-ink-faint">Reading the layer's properties…</p>;
  if (!fields.length) return <p className="text-ink-faint">This layer's features have no properties to filter by.</p>;

  return (
    <div className="flex flex-col gap-3">
      {rows.length > 1 && (
        <div className="flex items-center gap-2">
          <span>Show features matching</span>
          <div role="group" aria-label="Match" className="flex rounded-lg border border-edge p-0.5">
            {FILTER_MATCHES.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={match === m}
                onClick={() => apply(m, rows)}
                className={`cursor-pointer rounded-md px-2 py-0.5 ${match === m ? 'bg-accent text-on-accent' : 'hover:bg-hover'}`}
              >
                {MATCH_LABELS[m]}
              </button>
            ))}
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <ConditionRow
              key={row.key}
              condition={row}
              fields={fields}
              showProblem={flagged.has(row.key)}
              onChange={(changed) => apply(match, rows.map((r) => (r.key === row.key ? changed : r)))}
              onRemove={() => apply(match, rows.filter((r) => r.key !== row.key))}
            />
          ))}
        </ul>
      )}

      <div className="flex gap-1.5">
        <Button
          disabled={rows.length >= MAX_FILTER_CONDITIONS}
          onClick={() => apply(match, [...rows, withKey({ field: '', op: 'eq', value: '' })])}
          className="border border-edge"
        >
          <PlusIcon /> Add condition
        </Button>
        {rows.length > 0 && <Button onClick={() => apply(match, [])}>Clear</Button>}
      </div>

      {layer.filter && (
        <p aria-live="polite" className="text-ink-faint">
          Showing {layer.matching ?? '…'} of {layer.count} features
        </p>
      )}

      <hr className="border-hairline" />
      <SaveAsLayerForm disabled={!rows.length || (layer.filter && layer.matching === 0)} onSave={save} />
    </div>
  );
}
