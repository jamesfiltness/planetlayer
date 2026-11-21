import { symbologyTypesFor } from '../../../shared/symbology.js';
import Dropdown from './Dropdown.jsx';
import SymbologyIcon from './SymbologyIcon.jsx';

/**
 * The Style tab's menu of symbology types: how the layer's features are
 * coloured and sized from their data. Only the types the layer's shape can
 * use are offered (see shared/symbology.js), each with a small picture.
 * A type that colours by a property is disabled, saying why, until the
 * layer's properties are read, and when none of them fits it.
 *
 * @param {object} props
 * @param {string} props.shape the layer's shape: point, line or polygon
 * @param {string} props.value the current symbology type
 * @param {{ fields: object[] | null, error: string | null }} props.summaries from useFieldSummaries
 * @param {(type: string) => void} props.onChange called with the chosen type
 */
export default function StyleTypePicker({ shape, value, summaries, onChange }) {
  const options = symbologyTypesFor(shape).map(({ type, label, fits, noField }) => {
    const hint = fits && unavailable(summaries, fits, noField);
    return { value: type, label, picture: <SymbologyIcon type={type} />, disabled: Boolean(hint) && type !== value, hint: hint || undefined };
  });
  return <Dropdown label="Style" value={value} options={options} onChange={onChange} />;
}

// Why a type that needs a property can't be chosen yet, or '' if it can.
function unavailable({ fields, error }, fits, noField) {
  if (error) return "Couldn't read the layer's properties";
  if (!fields) return "Reading the layer's properties…";
  return fields.some(fits) ? '' : noField;
}
