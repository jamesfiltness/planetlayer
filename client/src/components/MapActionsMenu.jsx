import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { MoreIcon } from './icons.jsx';

const ITEM = 'block w-full rounded-lg px-3 py-2 text-left cursor-pointer';

export default function MapActionsMenu({ mapName, onRename, onDelete }) {
  return (
    <Menu>
      <MenuButton
        aria-label={`Actions for ${mapName}`}
        className="flex-none cursor-pointer rounded-lg p-2 text-gray-500 hover:bg-hover hover:text-ink data-open:bg-hover"
      >
        <MoreIcon />
      </MenuButton>
      <MenuItems
        anchor={{ to: 'bottom end', gap: 4 }}
        className="z-40 min-w-36 rounded-xl bg-white p-1.5 shadow-panel outline-none"
      >
        <MenuItem>
          <button type="button" onClick={onRename} className={`${ITEM} data-focus:bg-hover`}>Rename</button>
        </MenuItem>
        <MenuItem>
          <button type="button" onClick={onDelete} className={`${ITEM} text-red-700 data-focus:bg-red-50`}>Delete</button>
        </MenuItem>
      </MenuItems>
    </Menu>
  );
}
