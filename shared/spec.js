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

// Each field is a layer picker (limited to `shapes`, or to the shape of the
// layer picked in `sameShapeAs`), a property of the layer picked in
// `fieldOf`, or a plain setting.
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
  { id: 'count', label: 'Count points', hint: 'Count the points inside each area', fields: [
    { key: 'areas', label: 'Areas', shapes: ['polygon'] },
    { key: 'points', label: 'Points', shapes: ['point'] },
  ] },
  { id: 'centroid', label: 'Centroid', hint: 'Turn each shape into a point at its centre', fields: [
    { key: 'layer', label: 'Layer', shapes: ['line', 'polygon'] },
  ] },
  { id: 'combine', label: 'Combine', hint: 'Put two layers of the same shape together', fields: [
    { key: 'layer', label: 'Layer', shapes: SHAPES },
    { key: 'other', label: 'With', sameShapeAs: 'layer' },
  ] },
];
