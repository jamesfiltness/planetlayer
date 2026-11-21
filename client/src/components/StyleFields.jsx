// The labelled inputs used by the layer editor's Style tab.

/**
 * A colour swatch that opens the browser's colour picker, with the colour's
 * hex code beside it.
 *
 * @param {object} props
 * @param {string} props.label
 * @param {string} props.value a six-digit hex colour, like #1a2b3c
 * @param {(value: string) => void} props.onChange
 */
export function ColorField({ label, value, onChange }) {
  return (
    <label className="flex items-center gap-2">
      <span className="flex-1">{label}</span>
      <span className="text-xs text-ink-faint uppercase">{value}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-10 flex-none cursor-pointer rounded-md border border-edge bg-surface p-0.5"
      />
    </label>
  );
}

/**
 * A slider from 0 to `max`, with its value shown beside the label.
 *
 * @param {object} props
 * @param {string} props.label
 * @param {number} props.value
 * @param {number} props.max
 * @param {number} props.step
 * @param {(value: number) => string} props.format how the value is shown, e.g. as a percentage
 * @param {(value: number) => void} props.onChange
 */
export function SliderField({ label, value, max, step, format, onChange }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex justify-between">
        {label}
        <span className="text-ink-faint">{format(value)}</span>
      </span>
      <input
        type="range"
        min={0}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer accent-accent"
      />
    </label>
  );
}
