import { SIZE_LIMITS } from '../../../shared/symbology.js';
import { formatNumber } from './formatNumber.js';
import { SliderField } from './StyleFields.jsx';

const pixels = (n) => `${n} px`;

/**
 * A size style's settings: the radius of the smallest and biggest circles,
 * and a legend showing each beside the value it stands for. Moving one size
 * past the other moves that one too, so the smallest is never the bigger.
 *
 * @param {object} props
 * @param {{ min: number, max: number, minSize: number, maxSize: number }} props.symbology
 * @param {string} props.color the circles' colour, the layer's fill colour
 * @param {(symbology: object) => void} props.onChange called with the whole new symbology
 */
export default function SizeFields({ symbology, color, onChange }) {
  const { min, max, minSize, maxSize } = symbology;
  const [lowest, highest] = SIZE_LIMITS;
  const setMin = (n) => onChange({ ...symbology, minSize: n, maxSize: Math.max(n, maxSize) });
  const setMax = (n) => onChange({ ...symbology, maxSize: n, minSize: Math.min(n, minSize) });

  return (
    <>
      <SliderField label="Smallest size" value={minSize} min={lowest} max={highest} step={1} format={pixels} onChange={setMin} />
      <SliderField label="Biggest size" value={maxSize} min={lowest} max={highest} step={1} format={pixels} onChange={setMax} />
      <div className="flex items-end justify-between text-ink-faint">
        <Circle radius={minSize} color={color} label={formatNumber(min)} />
        <Circle radius={maxSize} color={color} label={formatNumber(max)} />
      </div>
    </>
  );
}

function Circle({ radius, color, label }) {
  return (
    <span className="flex flex-col items-center gap-1">
      <span className="rounded-full border border-edge" style={{ width: radius * 2, height: radius * 2, backgroundColor: color }} />
      {label}
    </span>
  );
}
