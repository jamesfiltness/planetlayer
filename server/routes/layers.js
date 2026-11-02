// Layer ids are unique across maps, so these routes don't need the map.
import { Router } from 'express';
import { deleteLayer, layerGeoJson } from '../layers.js';

export const layersRouter = Router();

layersRouter.delete('/:id', async (req, res) => {
  await deleteLayer(req.params.id);
  res.status(204).end();
});

layersRouter.get('/:id/geojson', async (req, res) => {
  res.type('json').send(await layerGeoJson(req.params.id));
});
