import { useState } from 'react';
import ConfirmDeleteModal from './ConfirmDeleteModal.jsx';

/**
 * The map's layers, in the toolbar's Layers menu: a checkbox to show or hide
 * each, its colour, name and feature count, and a button to delete it.
 *
 * @param {object} props
 * @param {object[]} props.layers
 * @param {Set<number>} props.hidden
 * @param {(id: number) => void} props.onToggle
 * @param {(layer: object) => Promise<void>} props.onDelete throws on failure
 */
export default function LayerList({ layers, hidden, onToggle, onDelete }) {
  const [deleting, setDeleting] = useState(null);

  if (!layers.length) return <div className="px-3 py-2 text-gray-500">No layers yet</div>;

  return (
    <>
      {layers.map((l) => (
        <div key={l.id} className="flex items-center gap-2 px-1 py-0.5">
          <input
            type="checkbox"
            aria-label={`Show ${l.name}`}
            checked={!hidden.has(l.id)}
            onChange={() => onToggle(l.id)}
          />
          <span className="size-3 flex-none rounded-[3px]" style={{ background: l.color }} />
          <span className="max-w-[220px] flex-1 truncate" title={l.name}>{l.name}</span>
          <span className="text-xs text-gray-500">{l.count}</span>
          <button
            type="button"
            title="Delete layer"
            aria-label={`Delete ${l.name}`}
            onClick={() => setDeleting(l)}
            className="cursor-pointer rounded-lg px-2 py-1 hover:bg-hover"
          >
            ×
          </button>
        </div>
      ))}

      {deleting && (
        <ConfirmDeleteModal title={`Delete "${deleting.name}"?`} onConfirm={() => onDelete(deleting)} onClose={() => setDeleting(null)}>
          Its {deleting.count} {deleting.count === 1 ? 'feature' : 'features'} will be deleted. This can't be undone.
        </ConfirmDeleteModal>
      )}
    </>
  );
}
