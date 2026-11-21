import { FIELD } from './fieldClass.js';

/**
 * Which of the layer's properties the style colours by. Only the properties
 * that suit the style type are offered (its `fits` in shared/symbology.js).
 * A property the style names that no longer fits, or that the layer's
 * features no longer have, is still listed so the menu can show it.
 *
 * @param {object} props
 * @param {string} props.value the property the style uses now
 * @param {object[]} props.fields the layer's property summaries, from useFieldSummaries
 * @param {(field: object) => boolean} props.fits which properties the style type can use
 * @param {(field: object) => void} props.onChange called with the chosen property's summary
 */
export default function PropertyPicker({ value, fields, fits, onChange }) {
  const fitting = fields.filter(fits);
  return (
    <label className="flex flex-col gap-1">
      Property
      <select className={FIELD} value={value} onChange={(e) => onChange(fields.find((f) => f.name === e.target.value))}>
        {!fitting.some((f) => f.name === value) && <option value={value} disabled>{value}</option>}
        {fitting.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
      </select>
    </label>
  );
}
