/**
 * Starts the server: brings the database schema up to date, then listens.
 * Configured by environment variables (see the README): DATABASE_URL,
 * LISTEN_ADDRESS, PORT and ALLOWED_HOSTS.
 */
import { createApp } from './app.js';
import { migrate } from './db.js';

await migrate();

// Local-only unless told otherwise. In Docker this is 0.0.0.0 and the
// published port decides who can reach it.
const address = process.env.LISTEN_ADDRESS ?? '127.0.0.1';
const port = process.env.PORT ?? 8080;
createApp().listen(port, address, () => console.log(`Spatial Analysis on http://localhost:${port} (listening on ${address})`));
