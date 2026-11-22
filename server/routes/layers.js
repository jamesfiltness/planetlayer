// Layer ids are unique across maps, so these routes don't need the map.
import { Router } from 'express';
import { fieldSummaries } from '../filter/fields.js';
import { saveFilteredAsLayer, saveLayerFilter } from '../layerFilter.js';
import { deleteLayer, layerGeoJson, saveLayerStyle } from '../layers.js';
import { setLayerVisibility } from '../layerVisibility.js';
import { calculateProperty } from '../properties/calculate.js';

export const layersRouter = Router();

layersRouter.put('/:id/style', async (req, res) => {
  await saveLayerStyle(req.params.id, req.body);
  res.status(204).end();
});

// Shows or hides the layer on the map: `{ "visible": true | false }`.
layersRouter.put('/:id/visible', async (req, res) => {
  await setLayerVisibility(req.params.id, req.body?.visible);
  res.status(204).end();
});

// The filter is wrapped in an object, because a JSON body can't be a bare null.
layersRouter.put('/:id/filter', async (req, res) => {
  res.json(await saveLayerFilter(req.params.id, req.body?.filter));
});

layersRouter.get('/:id/fields', async (req, res) => {
  res.json(await fieldSummaries(req.params.id));
});

// Sets a property from an expression: `{ "name": "…", "expression": "…" }`.
layersRouter.post('/:id/properties/calculate', async (req, res) => {
  res.json(await calculateProperty(req.params.id, req.body ?? {}));
});

layersRouter.post('/:id/filtered', async (req, res) => {
  res.status(201).json(await saveFilteredAsLayer(req.params.id, req.body));
});

layersRouter.delete('/:id', async (req, res) => {
  await deleteLayer(req.params.id);
  res.status(204).end();
});

layersRouter.get('/:id/geojson', async (req, res) => {
  res.type('json').send(await layerGeoJson(req.params.id));
});
