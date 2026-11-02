/**
 * /api/layers/:id: operations on one layer. Layer ids are unique across all
 * maps, so these don't need the map. Listing and creating layers happen
 * within a map, in routes/maps.js.
 */
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
