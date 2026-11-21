// Naming the MapLibre sources that hold our layers' features, and the colour
// that stands for a layer in lists. How a layer is drawn lives in renderers/.

export const SOURCE_PREFIX = 'layer-';

export const sourceId = (layerId) => `${SOURCE_PREFIX}${layerId}`;

// The colour that stands for a layer in lists: its fill, or a line's own colour.
export const layerColor = ({ shape, style }) => (shape === 'line' ? style.outlineColor : style.fillColor);
