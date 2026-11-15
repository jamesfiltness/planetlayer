function Icon({ size = 16, children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const ChevronIcon = ({ up }) => <Icon><path d={up ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} /></Icon>;

export const BackIcon = () => <Icon><path d="m15 18-6-6 6-6" /></Icon>;

export const PlusIcon = () => <Icon><path d="M12 5v14M5 12h14" /></Icon>;

export const MoreIcon = () => (
  <Icon size={18}>
    <circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" />
  </Icon>
);

export const EyeIcon = () => (
  <Icon>
    <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

export const EyeOffIcon = () => (
  <Icon>
    <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
    <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
    <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
    <path d="m2 2 20 20" />
  </Icon>
);

export const PencilIcon = () => (
  <Icon>
    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
    <path d="m15 5 4 4" />
  </Icon>
);

// Layer shapes: one icon per value of SHAPES in shared/spec.js.

export const PolygonIcon = () => <Icon><path d="M4 8.5 13 3l7.5 6.5-3 11.5H7Z" /></Icon>;

export const LineIcon = () => <Icon><path d="m3 17 6-9 6 7 6-9" /></Icon>;

export const PointsIcon = () => (
  <Icon>
    <circle cx="6" cy="7" r="2" fill="currentColor" />
    <circle cx="17.5" cy="9.5" r="2" fill="currentColor" />
    <circle cx="10" cy="17.5" r="2" fill="currentColor" />
  </Icon>
);
