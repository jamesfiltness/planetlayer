/**
 * The app's button, in one of a few looks. Any other props (onClick, type,
 * disabled, aria-*) go to the <button>; `className` adds to the look.
 */

const BASE = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 cursor-pointer disabled:cursor-default disabled:opacity-60';

const VARIANTS = {
  /** No background until hovered: toolbars, menus, Cancel. */
  ghost: 'hover:enabled:bg-hover',
  /** The main action on a page or in a form. */
  primary: 'bg-accent text-white hover:enabled:bg-accent/90',
  /** An action that destroys data. */
  danger: 'bg-red-600 text-white hover:enabled:bg-red-700',
};

/**
 * @param {{ variant?: keyof typeof VARIANTS } & import('react').ButtonHTMLAttributes<HTMLButtonElement>} props
 */
export default function Button({ variant = 'ghost', type = 'button', className = '', ...props }) {
  return <button type={type} className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />;
}
