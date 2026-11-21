import { CLUSTER_LIMITS } from '../../../shared/symbology.js';
import { SliderField } from './StyleFields.jsx';

const pixels = (n) => `${n} px`;

/**
 * A cluster style's setting: how close points must be on screen to be
 * grouped into one circle. Clicking a cluster on the map zooms in to split it.
 *
 * @param {object} props
 * @param {{ radius: number }} props.symbology
 * @param {(symbology: object) => void} props.onChange called with the whole new symbology
 */
export default function ClusterFields({ symbology, onChange }) {
  const [min, max] = CLUSTER_LIMITS;
  return (
    <>
      <SliderField
        label="Group points within"
        value={symbology.radius}
        min={min}
        max={max}
        step={5}
        format={pixels}
        onChange={(radius) => onChange({ ...symbology, radius })}
      />
      <p className="text-ink-faint">Click a cluster on the map to zoom in and split it.</p>
    </>
  );
}
