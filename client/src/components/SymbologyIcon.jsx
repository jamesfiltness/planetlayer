// A small picture of each symbology type in shared/symbology.js, shown
// beside its name in the Style tab's menu.

const SingleColour = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="text-ink-faint">
    <circle cx="5" cy="4.5" r="2.5" fill="currentColor" />
    <circle cx="12" cy="7" r="2.5" fill="currentColor" />
    <circle cx="6" cy="12" r="2.5" fill="currentColor" />
  </svg>
);

const ICONS = { single: SingleColour };

/**
 * @param {object} props
 * @param {string} props.type a symbology type; one with no picture of its own shows none
 */
export default function SymbologyIcon({ type }) {
  const Picture = ICONS[type];
  return <span className="flex w-4 flex-none justify-center">{Picture && <Picture />}</span>;
}
