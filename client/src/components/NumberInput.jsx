import { useState } from 'react';

/**
 * A number box that hands its parent a number, or '' while it's empty or
 * not yet a number. It keeps what's typed itself, so a half-typed value
 * such as "-" or "1." isn't wiped out. Key it to reset it.
 *
 * @param {object} props
 * @param {number | ''} props.value the starting value
 * @param {(value: number | '') => void} props.onChange
 */
export default function NumberInput({ value, onChange, className = '', ...props }) {
  const [text, setText] = useState(value === '' ? '' : String(value));

  const change = (e) => {
    const typed = e.target.value;
    setText(typed);
    const n = Number(typed);
    onChange(typed.trim() === '' || !Number.isFinite(n) ? '' : n);
  };

  return <input type="number" step="any" value={text} onChange={change} className={`min-w-0 ${className}`} {...props} />;
}
