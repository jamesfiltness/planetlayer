import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { MoreIcon } from './icons.jsx';

const ITEM = 'block w-full rounded-lg px-3 py-2 text-left cursor-pointer';

/**
 * A ⋯ button that opens a menu of actions.
 *
 * @param {object} props
 * @param {string} props.label what the button is for, read out by screen readers
 * @param {Array<{ label: string, onSelect: () => void, danger?: boolean }>} props.items
 *   `danger` marks a destructive action, shown in red
 */
export default function ActionsMenu({ label, items }) {
  return (
    <Menu>
      <MenuButton
        aria-label={label}
        className="flex-none cursor-pointer rounded-lg p-2 text-gray-500 hover:bg-hover hover:text-ink data-open:bg-hover"
      >
        <MoreIcon />
      </MenuButton>
      <MenuItems
        anchor={{ to: 'bottom end', gap: 4 }}
        className="z-40 min-w-36 rounded-xl bg-white p-1.5 shadow-panel outline-none"
      >
        {items.map((item) => (
          <MenuItem key={item.label}>
            <button
              type="button"
              onClick={item.onSelect}
              className={`${ITEM} ${item.danger ? 'text-red-700 data-focus:bg-red-50' : 'data-focus:bg-hover'}`}
            >
              {item.label}
            </button>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
}
