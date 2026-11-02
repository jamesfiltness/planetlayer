import { Router } from 'express';
import { rm } from 'node:fs/promises';
import { badRequest } from '../errors.js';
import { importFile } from '../import.js';
import { listLayers } from '../layers.js';
import { createMap, deleteMap, getMap, listMaps, renameMap } from '../maps.js';
import { runTool } from '../tools.js';
import { upload } from '../http/upload.js';

export const mapsRouter = Router();

mapsRouter.get('/', async (req, res) => {
  res.json(await listMaps());
});

mapsRouter.post('/', async (req, res) => {
  res.status(201).json(await createMap(req.body?.name));
});

mapsRouter.get('/:id', async (req, res) => {
  res.json(await getMap(req.params.id));
});

mapsRouter.patch('/:id', async (req, res) => {
  res.json(await renameMap(req.params.id, req.body?.name));
});

mapsRouter.delete('/:id', async (req, res) => {
  await deleteMap(req.params.id);
  res.status(204).end();
});

// Runs before the upload, so a file sent to a missing map isn't stored.
async function requireMap(req, res, next) {
  req.map = await getMap(req.params.id);
  next();
}

mapsRouter.get('/:id/layers', requireMap, async (req, res) => {
  res.json(await listLayers(req.map.id));
});

mapsRouter.post('/:id/import', requireMap, upload.single('file'), async (req, res) => {
  if (!req.file) throw badRequest('No file uploaded.');
  try {
    res.json(await importFile(req.file, req.map.id));
  } finally {
    await rm(req.file.path, { force: true });
  }
});

mapsRouter.post('/:id/tools/:tool', requireMap, async (req, res) => {
  res.json(await runTool(req.map.id, req.params.tool, req.body));
});
