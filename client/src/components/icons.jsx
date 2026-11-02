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
