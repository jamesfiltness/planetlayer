/**
 * Builds the Express app: security checks, the API, the built client, and
 * error handling. Kept apart from index.js (which listens and migrates) so
 * tests can start the real app on a spare port.
 */
import express from 'express';
import path from 'node:path';
import { notFound } from './errors.js';
import { hostGuard, parseAllowedHosts } from './http/hostGuard.js';
import { layersRouter } from './routes/layers.js';
import { mapsRouter } from './routes/maps.js';

const DEFAULT_CLIENT_DIR = path.join(import.meta.dirname, '../client/dist');

/**
 * @param {object} [options]
 * @param {string} [options.clientDir] the built client (Vite's dist folder)
 * @param {string[]} [options.allowedHosts] extra host names to answer to; defaults to ALLOWED_HOSTS
 */
export function createApp({ clientDir = DEFAULT_CLIENT_DIR, allowedHosts = parseAllowedHosts(process.env.ALLOWED_HOSTS) } = {}) {
  const app = express();

  // Before anything else, so a refused request never reaches the API or files.
  app.use(hostGuard(allowedHosts));
  app.use(express.json());

  app.use('/api/maps', mapsRouter);
  app.use('/api/layers', layersRouter);
  app.use('/api', (req, res, next) => next(notFound(`No API route for ${req.method} ${req.originalUrl}.`)));

  app.use(express.static(clientDir));
  // The client routes pages itself (/, /maps/3, …), so any other page request
  // gets index.html. This is what lets a map's address be reloaded or shared.
  app.get('/{*path}', (req, res) => res.sendFile(path.join(clientDir, 'index.html')));

  // Errors with a status (see errors.js) are expected and meant for the user;
  // anything else is a bug, logged here and reported as a 500.
  app.use((error, req, res, next) => {
    if (!error.status) console.error(error);
    res.status(error.status ?? 500).json({ error: error.message });
  });

  return app;
}
