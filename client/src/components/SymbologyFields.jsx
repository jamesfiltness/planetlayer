import { symbologyType } from '../../../shared/symbology.js';
import { buildSymbology, startingField } from '../map/buildSymbology.js';
import CategoriesLegend from './CategoriesLegend.jsx';
import PropertyPicker from './PropertyPicker.jsx';
import ScaleFields from './ScaleFields.jsx';
import SizeFields from './SizeFields.jsx';
import StyleTypePicker from './StyleTypePicker.jsx';

/**
 * The top of the Style tab: the symbology type, and for a type that colours
 * by a property, which property and how (see shared/symbology.js).
 *
 * Choosing a type starts it on the property that suits it best (see
 * startingField); choosing another property works out its categories or
 * range afresh (see buildSymbology).
 *
 * @param {object} props
 * @param {string} props.shape the layer's shape
 * @param {{ type: string, field?: string }} props.symbology
 * @param {string} props.fillColor the layer's fill colour, which a size style draws with
 * @param {{ fields: object[] | null, error: string | null }} props.summaries from useFieldSummaries
 * @param {(symbology: object) => void} props.onChange called with the whole new symbology
 */
export default function SymbologyFields({ shape, symbology, fillColor, summaries, onChange }) {
  const { type } = symbology;
  const { fits } = symbologyType(type) ?? {};
  const fields = summaries.fields;
  const field = fields?.find((f) => f.name === symbology.field);

  // The menu disables a type no property fits, so `start` is only missing
  // for a type that needs no property.
  const setType = (next) => {
    const start = startingField(next, fields ?? []);
    if (next === type || (symbologyType(next)?.fits && !start)) return;
    onChange(buildSymbology(next, start, symbology));
  };

  return (
    <>
      <StyleTypePicker shape={shape} value={type} summaries={summaries} onChange={setType} />
      {fits && fields && (
        <PropertyPicker value={symbology.field} fields={fields} fits={fits} onChange={(f) => onChange(buildSymbology(type, f, symbology))} />
      )}
      {type === 'categories' && <CategoriesLegend categories={symbology.categories} field={field} />}
      {type === 'scale' && <ScaleFields symbology={symbology} onRampChange={(ramp) => onChange({ ...symbology, ramp })} />}
      {type === 'size' && <SizeFields symbology={symbology} color={fillColor} onChange={onChange} />}
    </>
  );
}
