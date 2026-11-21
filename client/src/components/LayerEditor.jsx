import { useState } from 'react';
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';
import ActionsMenu from './ActionsMenu.jsx';
import ConfirmDeleteModal from './ConfirmDeleteModal.jsx';
import FilterTab from './FilterTab.jsx';
import { CloseIcon } from './icons.jsx';
import StyleTab from './StyleTab.jsx';

const TAB = 'cursor-pointer border-b-2 border-transparent px-1 py-2 text-gray-500 outline-none data-focus:text-ink data-selected:border-accent data-selected:font-semibold data-selected:text-ink';

/**
 * The floating editor for one layer, down the right side of the map. Its
 * header has the layer's name, a ⋯ menu for deleting the layer and a close
 * button; below are its Style and Filter tabs.
 *
 * @param {object} props
 * @param {{ id: number, name: string, shape: string, count: number, matching: number | null, style: object, filter: object | null }} props.layer
 * @param {(style: object) => void} props.onStyleChange called with the whole new style on every change
 * @param {(filter: object | null) => void} props.onFilterChange called with the whole new filter when it changes
 * @param {(filter: object, name: string) => Promise<boolean>} props.onSaveFiltered saves the matching features as a new layer
 * @param {() => Promise<void>} props.onDelete deletes the layer; a rejection is shown in the confirmation
 * @param {() => void} props.onClose
 */
export default function LayerEditor({ layer, onStyleChange, onFilterChange, onSaveFiltered, onDelete, onClose }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <section
      aria-label={`Edit ${layer.name}`}
      className="chrome-float absolute top-map-top right-4 z-10 flex max-h-[calc(100vh_-_var(--spacing-map-top)_-_16px)] w-80 max-w-[calc(100vw-32px)] flex-col rounded-xl shadow-panel"
    >
      <header className="flex items-center gap-1 py-1.5 pr-1.5 pl-3.5">
        <h2 className="min-w-0 flex-1 truncate font-semibold" title={layer.name}>{layer.name}</h2>
        <ActionsMenu
          label={`Actions for ${layer.name}`}
          items={[{ label: 'Delete layer', danger: true, onSelect: () => setConfirmingDelete(true) }]}
        />
        <button
          type="button"
          title="Close"
          aria-label="Close the layer editor"
          onClick={onClose}
          className="flex-none cursor-pointer rounded-lg p-2 text-gray-500 hover:bg-hover hover:text-ink"
        >
          <CloseIcon />
        </button>
      </header>

      <TabGroup className="flex min-h-0 flex-col">
        <TabList className="flex gap-4 border-b border-gray-200 px-3.5">
          <Tab className={TAB}>Style</Tab>
          <Tab className={TAB}>Filter</Tab>
        </TabList>
        <TabPanels className="overflow-auto p-3.5">
          <TabPanel className="outline-none">
            <StyleTab shape={layer.shape} style={layer.style} onChange={onStyleChange} />
          </TabPanel>
          {/* Kept mounted while hidden, so unfinished conditions survive a look at Style. */}
          <TabPanel unmount={false} className="outline-none">
            <FilterTab key={layer.id} layer={layer} onChange={onFilterChange} onSaveAsLayer={onSaveFiltered} />
          </TabPanel>
        </TabPanels>
      </TabGroup>

      {confirmingDelete && (
        <ConfirmDeleteModal title={`Delete "${layer.name}"?`} onConfirm={onDelete} onClose={() => setConfirmingDelete(false)}>
          Its {layer.count} {layer.count === 1 ? 'feature' : 'features'} will be deleted. This can't be undone.
        </ConfirmDeleteModal>
      )}
    </section>
  );
}
