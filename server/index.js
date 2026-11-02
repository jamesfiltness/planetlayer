import { createApp } from './app.js';
import { migrate } from './db.js';

await migrate();

// Local-only unless told otherwise. In Docker this is 0.0.0.0 and the
// published port decides who can reach it.
const address = process.env.LISTEN_ADDRESS ?? '127.0.0.1';
const port = process.env.PORT ?? 8080;
createApp().listen(port, address, () => console.log(`Spatial Analysis on http://localhost:${port} (listening on ${address})`));
