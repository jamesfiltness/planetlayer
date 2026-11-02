import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../api.js';
import Button from '../components/Button.jsx';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal.jsx';
import { PlusIcon } from '../components/icons.jsx';
import MapListItem from '../components/MapListItem.jsx';
import MapNameModal from '../components/MapNameModal.jsx';

/**
 * The home page: every map, most recently edited first, with buttons to
 * create, open, rename and delete them.
 */
export default function MapListPage() {
  const navigate = useNavigate();
  const [maps, setMaps] = useState(null); // null while loading
  const [loadError, setLoadError] = useState(null);
  // At most one modal is open: { type: 'create' | 'rename' | 'delete', map? }.
  const [modal, setModal] = useState(null);

  const load = useCallback(() => {
    setLoadError(null);
    return api.maps().then(setMaps, (error) => setLoadError(error.message));
  }, []);

  useEffect(() => {
    document.title = 'Spatial Analysis';
    load();
  }, [load]);

  const create = async (name) => {
    const map = await api.createMap(name);
    navigate(`/maps/${map.id}`);
  };
  // Renaming counts as an edit, so the map moves to the top: reload the list
  // rather than reorder it here.
  const rename = async (name) => {
    await api.renameMap(modal.map.id, name);
    await load();
  };
  const remove = async () => {
    await api.deleteMap(modal.map.id);
    setMaps((ms) => ms.filter((m) => m.id !== modal.map.id));
  };

  const newMap = (
    <Button variant="primary" onClick={() => setModal({ type: 'create' })}>
      <PlusIcon /> New map
    </Button>
  );

  return (
    <main className="min-h-full bg-gray-50">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Maps</h1>
          {maps?.length > 0 && newMap}
        </header>

        {loadError && (
          <div role="alert" className="flex items-center justify-between gap-4 rounded-xl bg-red-50 px-4 py-3 text-red-800">
            Couldn't load your maps: {loadError}
            <Button onClick={load}>Try again</Button>
          </div>
        )}

        {!maps && !loadError && <p className="text-gray-500">Loading maps…</p>}

        {maps?.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-xl bg-white px-4 py-12 text-center ring-1 ring-black/5">
            <h2 className="text-lg font-semibold">No maps yet</h2>
            <p className="text-gray-600">Create a map, then add layers to it from files.</p>
            {newMap}
          </div>
        )}

        {maps?.length > 0 && (
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl bg-white ring-1 ring-black/5">
            {maps.map((map) => (
              <MapListItem
                key={map.id}
                map={map}
                onRename={() => setModal({ type: 'rename', map })}
                onDelete={() => setModal({ type: 'delete', map })}
              />
            ))}
          </ul>
        )}
      </div>

      {modal?.type === 'create' && (
        <MapNameModal title="New map" submitLabel="Create" onSubmit={create} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'rename' && (
        <MapNameModal title="Rename map" submitLabel="Rename" initialName={modal.map.name} onSubmit={rename} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'delete' && (
        <ConfirmDeleteModal title={`Delete "${modal.map.name}"?`} onConfirm={remove} onClose={() => setModal(null)}>
          {modal.map.layer_count > 0 && `Its ${modal.map.layer_count} ${modal.map.layer_count === 1 ? 'layer' : 'layers'} will be deleted too. `}
          This can't be undone.
        </ConfirmDeleteModal>
      )}
    </main>
  );
}
