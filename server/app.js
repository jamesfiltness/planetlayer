// Separate from index.js so tests can start the app on a spare port.
import express from 'express';
import path from 'node:path';
import { notFound } from './errors.js';
import { errorHandler } from './http/errorHandler.js';
import { hostGuard, parseAllowedHosts } from './http/hostGuard.js';
import { securityHeaders } from './http/securityHeaders.js';
import { layersRouter } from './routes/layers.js';
import { mapsRouter } from './routes/maps.js';
import { settingsRouter } from './routes/settings.js';

const DEFAULT_CLIENT_DIR = path.join(import.meta.dirname, '../client/dist');

export function createApp({ clientDir = DEFAULT_CLIENT_DIR, allowedHosts = parseAllowedHosts(process.env.ALLOWED_HOSTS) } = {}) {
  const app = express();
  app.disable('x-powered-by');

  // Before anything else, so a refused request never reaches the API or files,
  // and every response (refusals included) carries the security headers.
  app.use(securityHeaders);
  app.use(hostGuard(allowedHosts));
  app.use(express.json());

  app.use('/api/maps', mapsRouter);
  app.use('/api/layers', layersRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api', (req, res, next) => next(notFound(`No API route for ${req.method} ${req.originalUrl}.`)));

  app.use(express.static(clientDir));
  // The client routes pages itself (/, /maps/3, …), so any other page request
  // gets index.html. This is what lets a map's address be reloaded or shared.
  app.get('/{*path}', (req, res) => res.sendFile(path.join(clientDir, 'index.html')));

  app.use(errorHandler);

  return app;
}
