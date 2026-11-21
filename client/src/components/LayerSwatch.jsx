import { OTHER_COLOR, RAMPS } from '../../../shared/colors.js';
import { symbologyType } from '../../../shared/symbology.js';
import { layerColor } from '../map/style.js';
import { LineIcon, PointsIcon, PolygonIcon } from './icons.jsx';
import SymbologyIcon from './SymbologyIcon.jsx';

const SHAPES = {
  point: { Icon: PointsIcon, label: 'Points' },
  line: { Icon: LineIcon, label: 'Line' },
  polygon: { Icon: PolygonIcon, label: 'Area' },
};

/**
 * The small picture of a layer in the layers panel, so the panel doubles as
 * a legend. A layer drawn in one colour (a single colour, sized points or
 * clusters) shows its shape in that colour. Otherwise it shows its style:
 * its first three categories' colours, its colour ramp, or a heatmap.
 * Hovering says the shape, the style and the property it uses.
 *
 * @param {object} props
 * @param {{ shape: string, style: { symbology: { type: string, field?: string | null } } }} props.layer
 */
export default function LayerSwatch({ layer }) {
  const { symbology } = layer.style;
  const shape = SHAPES[layer.shape];
  const style = symbologyType(symbology.type)?.label;
  const description = [shape?.label, style && (symbology.field ? `${style} by ${symbology.field}` : style)].filter(Boolean).join(' · ');

  return (
    <span className="flex size-4 items-center justify-center" title={description}>
      <Picture layer={layer} Shape={shape?.Icon ?? PointsIcon} />
      <span className="sr-only">{description}</span>
    </span>
  );
}

function Picture({ layer, Shape }) {
  const { symbology } = layer.style;
  switch (symbology.type) {
    case 'categories': {
      const [a = OTHER_COLOR, b = OTHER_COLOR, c = OTHER_COLOR] = symbology.categories.map((category) => category.color);
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="5" cy="4.5" r="2.5" fill={a} /><circle cx="12" cy="7" r="2.5" fill={b} /><circle cx="6" cy="12" r="2.5" fill={c} />
        </svg>
      );
    }
    case 'scale': {
      const colors = RAMPS[symbology.ramp]?.colors ?? [OTHER_COLOR, OTHER_COLOR];
      return <span className="size-3.5 rounded-sm" style={{ backgroundImage: `linear-gradient(135deg, ${colors.join(', ')})` }} />;
    }
    case 'heatmap':
      return <SymbologyIcon type="heatmap" />;
    default:
      return <span style={{ color: layerColor(layer) }}><Shape /></span>;
  }
}
