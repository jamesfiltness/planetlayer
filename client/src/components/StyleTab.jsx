import { STYLE_LIMITS } from '../../../shared/limits.js';
import { ColorField, SliderField } from './StyleFields.jsx';
import StyleTypePicker from './StyleTypePicker.jsx';

// The top of each slider. Every range starts at 0, as the sliders do.
const MAX = Object.fromEntries(Object.entries(STYLE_LIMITS).map(([key, [, max]]) => [key, max]));

const percent = (n) => `${Math.round(n * 100)}%`;
const pixels = (n) => `${n} px`;

/**
 * The layer editor's Style tab. At the top is the symbology type: how the
 * features are coloured and sized from their data (see shared/symbology.js).
 * Below are the settings every type shares: fill opacity, outline colour and
 * width, and the opacity of the layer as a whole, plus the fill colour when
 * every feature is one colour. A line layer has no fill, so it gets only the
 * outline settings (named for the line) and the opacity.
 *
 * Choosing another type starts it from its defaults; the other style values
 * are kept, so switching back to a single colour gives the colour from before.
 *
 * @param {object} props
 * @param {string} props.shape the layer's shape: point, line or polygon
 * @param {{ fillColor: string, fillOpacity: number, outlineColor: string, outlineWidth: number, opacity: number, symbology: { type: string } }} props.style
 * @param {(style: object) => void} props.onChange called with the whole new style
 */
export default function StyleTab({ shape, style, onChange }) {
  const set = (key) => (value) => onChange({ ...style, [key]: value });
  const isLine = shape === 'line';
  const { type } = style.symbology;

  return (
    <div className="flex flex-col gap-4">
      <StyleTypePicker shape={shape} value={type} onChange={(next) => next !== type && set('symbology')({ type: next })} />
      {!isLine && (
        <>
          {type === 'single' && <ColorField label="Fill colour" value={style.fillColor} onChange={set('fillColor')} />}
          <SliderField label="Fill opacity" value={style.fillOpacity} max={MAX.fillOpacity} step={0.01} format={percent} onChange={set('fillOpacity')} />
        </>
      )}
      <ColorField label={isLine ? 'Line colour' : 'Outline colour'} value={style.outlineColor} onChange={set('outlineColor')} />
      <SliderField
        label={isLine ? 'Line width' : 'Outline width'}
        value={style.outlineWidth}
        max={MAX.outlineWidth}
        step={0.5}
        format={pixels}
        onChange={set('outlineWidth')}
      />
      <SliderField label="Overall opacity" value={style.opacity} max={MAX.opacity} step={0.01} format={percent} onChange={set('opacity')} />
    </div>
  );
}
