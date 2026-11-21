import { FIELD } from './fieldClass.js';

/**
 * Which of the layer's properties the style draws by. Only the properties
 * that suit the style type are offered (its `fits` in shared/symbology.js).
 * A property the style names that no longer fits, or that the layer's
 * features no longer have, is still listed so the menu can show it.
 *
 * @param {object} props
 * @param {string | null} props.value the property the style uses now; null for none
 * @param {object[]} props.fields the layer's property summaries, from useFieldSummaries
 * @param {(field: object) => boolean} props.fits which properties the style type can use
 * @param {string} [props.none] if given, the style can go without a property,
 *   and this labels the choice to; it's chosen as undefined
 * @param {(field: object | undefined) => void} props.onChange called with the chosen property's summary
 */
export default function PropertyPicker({ value, fields, fits, none, onChange }) {
  const fitting = fields.filter(fits);
  const chosen = value ?? '';
  return (
    <label className="flex flex-col gap-1">
      {none ? 'Weight' : 'Property'}
      <select className={FIELD} value={chosen} onChange={(e) => onChange(fields.find((f) => f.name === e.target.value))}>
        {none !== undefined && <option value="">{none}</option>}
        {chosen && !fitting.some((f) => f.name === chosen) && <option value={chosen} disabled>{chosen}</option>}
        {fitting.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
      </select>
    </label>
  );
}
