// Used by both the server and the client.

export const SHAPES = ['point', 'line', 'polygon'];

// File extension → the GDAL drivers allowed to read it. Naming the driver
// stops GDAL from sniffing the contents and choosing another one, such as a
// VRT that reads other files on the machine.
export const FORMATS = {
  '.geojson': ['GeoJSON'],
  '.json': ['GeoJSON', 'TopoJSON', 'ESRIJSON'],
  '.topojson': ['TopoJSON'],
  '.zip': ['ESRI Shapefile'],
  '.kml': ['KML'],
  '.kmz': ['KML'],
  '.gpx': ['GPX'],
  '.gpkg': ['GPKG'],
  '.fgb': ['FlatGeobuf'],
};

export const UNITS = { km: 1000, m: 1, mi: 1609.344 };

// What "Summarize within" can work out from a property's numbers in each area.
export const STATS = ['sum', 'mean', 'min', 'max'];

// Each field is a layer picker (limited to `shapes`, or to the shape of the
// layer picked in `sameShapeAs`), a property of the layer picked in
// `fieldOf`, or a plain setting. A property picker may be left blank; `none`
// says what blank means (it's "Everything" when not given). A field with
// `needs` only matters, and can only be set, once the field it names is.
export const TOOLS = [
  { id: 'buffer', label: 'Buffer', hint: 'Draw an area around each feature', fields: [
    { key: 'layer', label: 'Layer', shapes: SHAPES },
    { key: 'distance', label: 'Distance', type: 'number', initial: 1 },
    { key: 'unit', label: 'Unit', options: Object.keys(UNITS), initial: 'km' },
    { key: 'merge', label: 'Merge overlapping buffers', type: 'checkbox', initial: false },
  ] },
  { id: 'intersect', label: 'Intersect', hint: 'Keep the part inside areas', fields: [
    { key: 'layer', label: 'Layer', shapes: SHAPES },
    { key: 'areas', label: 'Areas', shapes: ['polygon'] },
  ] },
  { id: 'subtract', label: 'Subtract', hint: 'Keep the part outside areas', fields: [
    { key: 'layer', label: 'Layer', shapes: SHAPES },
    { key: 'areas', label: 'Areas', shapes: ['polygon'] },
  ] },
  { id: 'dissolve', label: 'Dissolve', hint: 'Merge shapes that share a value', fields: [
    { key: 'layer', label: 'Layer', shapes: ['line', 'polygon'] },
    { key: 'field', label: 'Merge shapes that share', fieldOf: 'layer', initial: '' },
  ] },
  { id: 'summarize', label: 'Summarize within', hint: 'Count the features in each area, and add up a property', fields: [
    { key: 'areas', label: 'Areas', shapes: ['polygon'] },
    { key: 'features', label: 'Features', shapes: SHAPES },
    { key: 'field', label: 'Add up', fieldOf: 'features', initial: '', none: 'Nothing, just count' },
    { key: 'stat', label: 'As', options: STATS, initial: 'sum', needs: 'field' },
  ] },
  { id: 'centroid', label: 'Centroid', hint: 'Turn each shape into a point at its centre', fields: [
    { key: 'layer', label: 'Layer', shapes: ['line', 'polygon'] },
  ] },
  { id: 'combine', label: 'Combine', hint: 'Put two layers of the same shape together', fields: [
    { key: 'layer', label: 'Layer', shapes: SHAPES },
    { key: 'other', label: 'With', sameShapeAs: 'layer' },
  ] },
];
