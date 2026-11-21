import { STYLE_LIMITS } from '../../../shared/limits.js';
import { symbologyType } from '../../../shared/symbology.js';
import { ColorField, SliderField } from './StyleFields.jsx';
import SymbologyFields from './SymbologyFields.jsx';

// The top of each slider. Every range starts at 0, as the sliders do.
const MAX = Object.fromEntries(Object.entries(STYLE_LIMITS).map(([key, [, max]]) => [key, max]));

const percent = (n) => `${Math.round(n * 100)}%`;
const pixels = (n) => `${n} px`;

/**
 * The layer editor's Style tab. At the top is the symbology: how the
 * features are coloured and sized from their data (see SymbologyFields).
 * Below are the layer's other style values that the symbology type draws
 * with (its `base` in shared/symbology.js): fill colour and opacity, outline
 * colour and width, and always the opacity of the layer as a whole.
 * A line layer has no fill, so it gets only the outline settings (named for
 * the line) and the opacity; its colour is the outline colour only when the
 * symbology uses the fill colour, and otherwise comes from the symbology.
 *
 * The other style values are kept when the symbology changes, so switching
 * back to a single colour gives the colour from before.
 *
 * @param {object} props
 * @param {string} props.shape the layer's shape: point, line or polygon
 * @param {{ fillColor: string, fillOpacity: number, outlineColor: string, outlineWidth: number, opacity: number, symbology: { type: string } }} props.style
 * @param {{ fields: object[] | null, error: string | null }} props.summaries the layer's properties, from useFieldSummaries
 * @param {(style: object) => void} props.onChange called with the whole new style
 */
export default function StyleTab({ shape, style, summaries, onChange }) {
  const set = (key) => (value) => onChange({ ...style, [key]: value });
  const isLine = shape === 'line';
  // A type saved by a newer version of the app is drawn as a single colour.
  const uses = new Set(symbologyType(style.symbology.type)?.base ?? symbologyType('single').base);

  return (
    <div className="flex flex-col gap-4">
      <SymbologyFields
        shape={shape}
        symbology={style.symbology}
        fillColor={style.fillColor}
        summaries={summaries}
        onChange={set('symbology')}
      />
      {!isLine && uses.has('fillColor') && <ColorField label="Fill colour" value={style.fillColor} onChange={set('fillColor')} />}
      {!isLine && uses.has('fillOpacity') && (
        <SliderField label="Fill opacity" value={style.fillOpacity} max={MAX.fillOpacity} step={0.01} format={percent} onChange={set('fillOpacity')} />
      )}
      {uses.has('outline') && (!isLine || uses.has('fillColor')) && (
        <ColorField label={isLine ? 'Line colour' : 'Outline colour'} value={style.outlineColor} onChange={set('outlineColor')} />
      )}
      {uses.has('outline') && (
        <SliderField
          label={isLine ? 'Line width' : 'Outline width'}
          value={style.outlineWidth}
          max={MAX.outlineWidth}
          step={0.5}
          format={pixels}
          onChange={set('outlineWidth')}
        />
      )}
      <SliderField label="Overall opacity" value={style.opacity} max={MAX.opacity} step={0.01} format={percent} onChange={set('opacity')} />
    </div>
  );
}
