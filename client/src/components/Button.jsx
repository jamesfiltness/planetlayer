const BASE = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 cursor-pointer disabled:cursor-default disabled:opacity-60';

const VARIANTS = {
  ghost: 'hover:enabled:bg-hover',
  primary: 'bg-accent text-white hover:enabled:bg-accent/90',
  danger: 'bg-red-600 text-white hover:enabled:bg-red-700',
};

export default function Button({ variant = 'ghost', type = 'button', className = '', ...props }) {
  return <button type={type} className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />;
}
