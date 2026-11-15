import AddLayerButton from './AddLayerButton.jsx';
import { EyeIcon, EyeOffIcon, LineIcon, PencilIcon, PointsIcon, PolygonIcon } from './icons.jsx';

const SHAPE_ICONS = { point: PointsIcon, line: LineIcon, polygon: PolygonIcon };

const ICON_BUTTON = 'flex-none cursor-pointer rounded-lg p-1.5 hover:bg-hover';

/**
 * The floating list of a map's layers, down the left side below the header.
 * Each row shows the layer's shape (drawn in the layer's colour, so the panel
 * doubles as a legend), its name, and an eye that shows or hides it on the map.
 * The plus beside the heading adds layers from files.
 *
 * @param {object} props
 * @param {Array<{ id: number, name: string, shape: string, color: string }>} props.layers
 * @param {Set<number>} props.hidden ids of the layers currently hidden on the map
 * @param {(id: number) => void} props.onToggle shows a hidden layer, or hides a visible one
 * @param {(files: File[]) => void} props.onImport imports the files picked with the plus
 */
export default function LayersPanel({ layers, hidden, onToggle, onImport }) {
  return (
    <section
      aria-label="Layers"
      className="absolute top-20 left-4 z-10 flex max-h-[calc(100vh-200px)] w-80 max-w-[calc(100vw-32px)] flex-col rounded-xl bg-white p-1.5 shadow-panel"
    >
      <div className="flex items-center justify-between pl-2">
        <h2 className="py-1.5 font-semibold">Layers</h2>
        <AddLayerButton onImport={onImport} />
      </div>
      {layers.length ? (
        <ul className="overflow-auto">
          {layers.map((layer) => (
            <LayerRow key={layer.id} layer={layer} visible={!hidden.has(layer.id)} onToggle={() => onToggle(layer.id)} />
          ))}
        </ul>
      ) : (
        <p className="px-2 pb-1.5 text-gray-500">No layers yet</p>
      )}
    </section>
  );
}

function LayerRow({ layer, visible, onToggle }) {
  const ShapeIcon = SHAPE_ICONS[layer.shape];
  const toggleLabel = visible ? 'Hide layer' : 'Show layer';

  return (
    <li className="group flex items-center gap-1 pl-2">
      <span className={`mr-1 flex-none ${visible ? '' : 'opacity-40'}`} style={{ color: layer.color }} title={layer.shape}>
        <ShapeIcon />
      </span>
      <span className={`min-w-0 flex-1 truncate ${visible ? '' : 'text-gray-400'}`} title={layer.name}>{layer.name}</span>

      {/* Editing isn't built yet, so the pencil does nothing. It appears on
          hover, and on keyboard focus so it can still be reached by tabbing. */}
      <button
        type="button"
        title="Edit layer"
        aria-label={`Edit ${layer.name}`}
        className={`${ICON_BUTTON} text-gray-600 opacity-0 group-hover:opacity-100 focus-visible:opacity-100`}
      >
        <PencilIcon />
      </button>

      <button
        type="button"
        title={toggleLabel}
        aria-label={`${toggleLabel} ${layer.name}`}
        onClick={onToggle}
        className={`${ICON_BUTTON} ${visible ? 'text-gray-600' : 'text-gray-400'}`}
      >
        {visible ? <EyeIcon /> : <EyeOffIcon />}
      </button>
    </li>
  );
}
