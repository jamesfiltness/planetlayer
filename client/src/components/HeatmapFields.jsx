import { HEATMAP_COLORS } from '../../../shared/colors.js';
import { HEATMAP_LIMITS } from '../../../shared/symbology.js';
import { SliderField } from './StyleFields.jsx';

const pixels = (n) => `${n} px`;
const times = (n) => `×${n.toFixed(1)}`;

/**
 * A heatmap's settings: how far each point spreads and how bright the whole
 * heatmap is, with a legend of its colours from sparse to dense, and a note
 * that the intensity is lowered when zoomed out (see heatmapIntensity.js).
 *
 * @param {object} props
 * @param {{ radius: number, intensity: number }} props.symbology
 * @param {(symbology: object) => void} props.onChange called with the whole new symbology
 */
export default function HeatmapFields({ symbology, onChange }) {
  const set = (key) => (value) => onChange({ ...symbology, [key]: value });
  const { radius, intensity } = HEATMAP_LIMITS;
  return (
    <>
      <SliderField label="Radius" value={symbology.radius} min={radius[0]} max={radius[1]} step={1} format={pixels} onChange={set('radius')} />
      <SliderField
        label="Intensity"
        value={symbology.intensity}
        min={intensity[0]}
        max={intensity[1]}
        step={0.1}
        format={times}
        onChange={set('intensity')}
      />
      <div className="flex flex-col gap-1">
        <span className="h-3 rounded-sm" style={{ backgroundImage: `linear-gradient(to right, transparent, ${HEATMAP_COLORS.join(', ')})` }} />
        <span className="flex justify-between text-ink-faint"><span>Sparse</span><span>Dense</span></span>
      </div>
      <p className="text-ink-faint">Zoomed out, the intensity is turned down for you, so crowded points don't all turn red.</p>
    </>
  );
}
