import { STYLE_LIMITS } from '../../../shared/limits.js';
import { ColorField, SliderField } from './StyleFields.jsx';

// The top of each slider. Every range starts at 0, as the sliders do.
const MAX = Object.fromEntries(Object.entries(STYLE_LIMITS).map(([key, [, max]]) => [key, max]));

const percent = (n) => `${Math.round(n * 100)}%`;
const pixels = (n) => `${n} px`;

/**
 * The layer editor's Style tab: fill colour and opacity, outline colour and
 * width, and the opacity of the layer as a whole. A line layer has no fill,
 * so it gets only the outline settings (named for the line) and the opacity.
 *
 * @param {object} props
 * @param {string} props.shape the layer's shape: point, line or polygon
 * @param {{ fillColor: string, fillOpacity: number, outlineColor: string, outlineWidth: number, opacity: number }} props.style
 * @param {(style: object) => void} props.onChange called with the whole new style
 */
export default function StyleTab({ shape, style, onChange }) {
  const set = (key) => (value) => onChange({ ...style, [key]: value });
  const isLine = shape === 'line';

  return (
    <div className="flex flex-col gap-4">
      {!isLine && (
        <>
          <ColorField label="Fill colour" value={style.fillColor} onChange={set('fillColor')} />
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
