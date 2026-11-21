import { Router } from 'express';
import { getSettings, updateSettings } from '../settings.js';

export const settingsRouter = Router();

settingsRouter.get('/', async (req, res) => {
  res.json(await getSettings());
});

// Partial: only the settings named in the body change. Answers with them all.
settingsRouter.patch('/', async (req, res) => {
  res.json(await updateSettings(req.body));
});
