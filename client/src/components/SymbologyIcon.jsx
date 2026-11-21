// A small picture of each symbology type in shared/symbology.js, shown
// beside its name in the Style tab's menu. Colours other than grey are
// fixed, so the pictures look the same in every theme.

const Svg = ({ children }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">{children}</svg>
);

const SingleColour = () => (
  <Svg>
    <g className="fill-ink-faint">
      <circle cx="5" cy="4.5" r="2.5" /><circle cx="12" cy="7" r="2.5" /><circle cx="6" cy="12" r="2.5" />
    </g>
  </Svg>
);

const Categories = () => (
  <Svg>
    <circle cx="5" cy="4.5" r="2.5" fill="#4e79a7" /><circle cx="12" cy="7" r="2.5" fill="#f28e2b" /><circle cx="6" cy="12" r="2.5" fill="#59a14f" />
  </Svg>
);

const ColourScale = () => (
  <Svg>
    <defs>
      <linearGradient id="symbology-icon-scale" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stopColor="#bdd7e7" /><stop offset="1" stopColor="#3182bd" />
      </linearGradient>
    </defs>
    <rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="url(#symbology-icon-scale)" />
  </Svg>
);

const ICONS = { single: SingleColour, categories: Categories, scale: ColourScale };

/**
 * @param {object} props
 * @param {string} props.type a symbology type; one with no picture of its own shows none
 */
export default function SymbologyIcon({ type }) {
  const Picture = ICONS[type];
  return <span className="flex w-4 flex-none justify-center">{Picture && <Picture />}</span>;
}
