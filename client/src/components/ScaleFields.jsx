import { NO_VALUE_COLOR, RAMPS } from '../../../shared/colors.js';
import Dropdown from './Dropdown.jsx';
import { formatNumber } from './formatNumber.js';

const gradient = (colors) => `linear-gradient(to right, ${colors.join(', ')})`;

const RampSwatch = ({ colors }) => (
  <span className="h-3 w-10 flex-none rounded-sm" style={{ backgroundImage: gradient(colors) }} />
);

const RAMP_OPTIONS = Object.entries(RAMPS).map(([value, { label, colors }]) => ({ value, label, picture: <RampSwatch colors={colors} /> }));

/**
 * A colour scale's settings: its ramp, and a legend of the ramp from the
 * property's lowest value to its highest, with the colour of features that
 * have no number.
 *
 * @param {object} props
 * @param {{ ramp: string, min: number, max: number }} props.symbology
 * @param {(ramp: string) => void} props.onRampChange
 */
export default function ScaleFields({ symbology, onRampChange }) {
  const { ramp, min, max } = symbology;
  return (
    <>
      <Dropdown label="Colours" value={ramp} options={RAMP_OPTIONS} onChange={onRampChange} />
      <div className="flex flex-col gap-1">
        <span className="h-3 rounded-sm" style={{ backgroundImage: gradient(RAMPS[ramp]?.colors ?? [NO_VALUE_COLOR]) }} />
        <span className="flex justify-between text-ink-faint">
          <span>{formatNumber(min)}</span>
          <span>{formatNumber(max)}</span>
        </span>
        <span className="flex items-center gap-2 text-ink-faint">
          <span className="size-3 rounded-full border border-edge" style={{ backgroundColor: NO_VALUE_COLOR }} />
          No value
        </span>
      </div>
    </>
  );
}
