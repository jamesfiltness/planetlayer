import { layerColor } from '../map/style.js';
import AddLayerButton from './AddLayerButton.jsx';
import { EyeIcon, EyeOffIcon, FilterIcon, LineIcon, PencilIcon, PointsIcon, PolygonIcon } from './icons.jsx';

const SHAPE_ICONS = { point: PointsIcon, line: LineIcon, polygon: PolygonIcon };

const ICON_BUTTON = 'flex-none cursor-pointer rounded-lg p-1.5 hover:bg-hover';

// What a filtered layer's funnel says. The count is left out while it isn't
// known (`matching` is null while a changed filter is being saved).
const filterSummary = (layer) =>
  layer.matching === null ? 'Filtered' : `Filtered: ${layer.matching} of ${layer.count} features shown`;

/**
 * The floating list of a map's layers, down the left side below the app header.
 * Each row shows the layer's shape (drawn in the layer's colour, so the panel
 * doubles as a legend), its name, a funnel if it's filtered, a pencil that
 * opens it in the layer editor, and an eye that shows or hides it on the map.
 * The plus beside the heading adds layers from files.
 *
 * @param {object} props
 * @param {Array<{ id: number, name: string, shape: string, style: object, filter: object | null, count: number, matching: number | null }>} props.layers
 * @param {Set<number>} props.hidden ids of the layers currently hidden on the map
 * @param {(id: number) => void} props.onToggle shows a hidden layer, or hides a visible one
 * @param {number | null} props.editingId id of the layer open in the editor, if any
 * @param {(id: number) => void} props.onEdit opens a layer in the editor
 * @param {(files: File[]) => void} props.onImport imports the files picked with the plus
 */
export default function LayersPanel({ layers, hidden, onToggle, editingId, onEdit, onImport }) {
  return (
    <section
      aria-label="Layers"
      className="chrome-float absolute top-map-top left-4 z-10 flex max-h-[calc(100vh_-_var(--spacing-map-top)_-_120px)] w-80 max-w-[calc(100vw-32px)] flex-col rounded-xl p-1.5 shadow-panel"
    >
      <div className="flex items-center justify-between pl-2">
        <h2 className="py-1.5 font-semibold">Layers</h2>
        <AddLayerButton onImport={onImport} />
      </div>
      {layers.length ? (
        <ul className="overflow-auto">
          {layers.map((layer) => (
            <LayerRow
              key={layer.id}
              layer={layer}
              visible={!hidden.has(layer.id)}
              editing={layer.id === editingId}
              onToggle={() => onToggle(layer.id)}
              onEdit={() => onEdit(layer.id)}
            />
          ))}
        </ul>
      ) : (
        <p className="px-2 pb-1.5 text-ink-faint">No layers yet</p>
      )}
    </section>
  );
}

function LayerRow({ layer, visible, editing, onToggle, onEdit }) {
  const ShapeIcon = SHAPE_ICONS[layer.shape];
  const toggleLabel = visible ? 'Hide layer' : 'Show layer';

  return (
    <li className="group flex items-center gap-1 pl-2">
      <span className={`mr-1 flex-none ${visible ? '' : 'opacity-40'}`} style={{ color: layerColor(layer) }} title={layer.shape}>
        <ShapeIcon />
      </span>
      <span className={`min-w-0 flex-1 truncate ${visible ? '' : 'text-ink-ghost'}`} title={layer.name}>{layer.name}</span>
      {layer.filter && (
        <span className="flex-none p-1.5 text-accent" title={filterSummary(layer)}>
          <FilterIcon size={14} />
          <span className="sr-only">{filterSummary(layer)}</span>
        </span>
      )}

      {/* Shown on hover, on keyboard focus so it can still be reached by
          tabbing, and for as long as this layer is open in the editor. */}
      <button
        type="button"
        title="Edit layer"
        aria-label={`Edit ${layer.name}`}
        aria-pressed={editing}
        onClick={onEdit}
        className={`${ICON_BUTTON} text-ink-muted ${editing ? 'bg-hover' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}`}
      >
        <PencilIcon />
      </button>

      <button
        type="button"
        title={toggleLabel}
        aria-label={`${toggleLabel} ${layer.name}`}
        onClick={onToggle}
        className={`${ICON_BUTTON} ${visible ? 'text-ink-muted' : 'text-ink-ghost'}`}
      >
        {visible ? <EyeIcon /> : <EyeOffIcon />}
      </button>
    </li>
  );
}
