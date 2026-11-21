// A small picture of each symbology type in shared/symbology.js, shown
// beside its name in the Style tab's menu. Colours other than grey are
// fixed, so the pictures look the same in every theme. A gradient's id is
// made per picture, as the same picture can be on the page more than once.

import { useId } from 'react';

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

function ColourScale() {
  const id = useId();
  return (
    <Svg>
      <defs>
        <linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#bdd7e7" /><stop offset="1" stopColor="#3182bd" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="13" height="13" rx="3" fill={`url(#${id})`} />
    </Svg>
  );
}

const Size = () => (
  <Svg>
    <g className="fill-ink-faint">
      <circle cx="5" cy="4.5" r="2" /><circle cx="10.5" cy="10" r="4" /><circle cx="3.5" cy="12" r="1.5" />
    </g>
  </Svg>
);

function Heatmap() {
  const id = useId();
  return (
    <Svg>
      <defs>
        <radialGradient id={id}>
          <stop offset="0" stopColor="#d7191c" /><stop offset="0.45" stopColor="#fdae61" />
          <stop offset="0.75" stopColor="#abd9e9" /><stop offset="1" stopColor="#2c7bb6" />
        </radialGradient>
      </defs>
      <circle cx="8" cy="8" r="6.5" fill={`url(#${id})`} />
    </Svg>
  );
}

const Cluster = () => (
  <Svg>
    <g className="text-ink-faint">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="6" cy="8" r="1.3" fill="currentColor" /><circle cx="10" cy="8" r="1.3" fill="currentColor" />
    </g>
  </Svg>
);

const ICONS = { single: SingleColour, categories: Categories, scale: ColourScale, size: Size, heatmap: Heatmap, cluster: Cluster };

/**
 * @param {object} props
 * @param {string} props.type a symbology type; one with no picture of its own shows none
 */
export default function SymbologyIcon({ type }) {
  const Picture = ICONS[type];
  return <span className="flex w-4 flex-none justify-center">{Picture && <Picture />}</span>;
}
