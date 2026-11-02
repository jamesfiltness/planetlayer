# Spatial Analysis

A self-hosted app for spatial analysis: as many maps as you like, each with an OpenStreetMap base map, your own layers stored in PostGIS, and seven analysis tools.

## Run it

```sh
docker compose up --build
```

Then open http://localhost:8080. Data is kept in the `data` volume; `docker compose down -v` starts clean.

The database schema is updated when the server starts. Upgrading from a version without multiple maps puts all your existing layers into one map called "My map".

### Sharing it on your network

By default only this computer can open the app. To let other devices on your network use it too:

```sh
BIND_ADDRESS=0.0.0.0 docker compose up --build
```

Then open `http://<this computer's IP>:8080` (or `http://<name>.local:8080`) on the other device. There are no logins, so anyone on that network can add, change and delete layers: only do this on a network you trust.

The app only answers to `localhost`, IP addresses and `.local` names, so other websites can't reach it through DNS tricks. To use another host name, list it: `ALLOWED_HOSTS=mybox,mybox.lan`. `APP_PORT=9000` changes the port.

## What it does

- **Maps:** the app opens on your list of maps, most recently edited first. Create one with **New map**; rename or delete one from its **⋯** menu. Deleting a map deletes its layers.
- **Add layer:** upload GeoJSON, zipped Shapefile, KML, KMZ, GPX, GeoPackage, FlatGeobuf or TopoJSON (or drop the file on the map). Files are read with GDAL and reprojected to WGS84. A file with several layers, or mixed points, lines and areas, becomes several layers.
- **Analyse:** each tool reads layers from the open map and writes a new layer to it.

| Tool | What it does |
| --- | --- |
| Buffer | Area around each feature (optionally merged) |
| Intersect | The part of a layer inside an area layer |
| Subtract | The part of a layer outside an area layer |
| Dissolve | Merge lines or areas sharing a property value |
| Count points | Number of points inside each area (a point on a shared border counts for both) |
| Centroid | A point at the centre of each shape |
| Combine | Two layers of the same shape as one |

Click a feature to see its properties.

## Layout

```
shared/spec.js             file formats, units and tool fields, used by both server and client

server/src/main.ts         startup: listen on LISTEN_ADDRESS and PORT
server/src/setup.ts        request order: host guard, client files, client pages, then the API
server/src/app.module.ts   the Nest modules below
server/src/config/         settings from the environment
server/src/database/       the Postgres pool, transactions, and migrations applied at startup
server/src/common/         host guard, client page fallback, error responses, id parsing
server/src/maps/           /api/maps: list, create, rename, delete; the guard for routes under a map
server/src/layers/         /api/maps/:id/layers and /api/layers: list, delete, GeoJSON
server/src/imports/        /api/maps/:id/import: GDAL import into a map
server/src/tools/          /api/maps/:id/tools: the analysis tools, in PostGIS
server/test/               unit tests, and integration tests against PostGIS and GDAL

client/src/main.jsx        routes: / (list of maps), /maps/:mapId (one map)
client/src/pages/          one component per route
client/src/components/     UI pieces: toolbar, tool form, modals, ⋯ menu, list row
client/src/map/            MapLibre: base style, drawing layers, feature popups
client/src/hooks/          state for a map's layers and the status banner
client/src/api.js          calls to the server API
```

The server is [NestJS](https://nestjs.com) in TypeScript. The client is React with MapLibre, styled with [Tailwind CSS](https://tailwindcss.com) (theme in `client/src/style.css`). Menus and modals use [Headless UI](https://headlessui.com) for keyboard and screen-reader support.

## API

The client uses this JSON API; errors come back as `{ "error": "message" }` with a 4xx or 5xx status.

| Method | Path | Does |
| --- | --- | --- |
| GET | `/api/maps` | Every map, most recently edited first, with `layer_count` |
| POST | `/api/maps` | Create a map: `{ "name": "…" }` |
| GET | `/api/maps/:id` | One map |
| PATCH | `/api/maps/:id` | Rename a map: `{ "name": "…" }` |
| DELETE | `/api/maps/:id` | Delete a map and its layers |
| GET | `/api/maps/:id/layers` | The map's layers, with feature `count` and property names (`fields`) |
| POST | `/api/maps/:id/import` | Import a file (multipart field `file`) into the map |
| POST | `/api/maps/:id/tools/:tool` | Run a tool on the map's layers (fields as in `shared/spec.js`) |
| DELETE | `/api/layers/:id` | Delete a layer |
| GET | `/api/layers/:id/geojson` | A layer's features as GeoJSON |

## Developing without Docker for the app

Run only the database in Docker, and the server and client locally (the server needs Node 24, and GDAL 3.11 or later for the `gdal`, `ogr2ogr` and `ogrinfo` commands):

```sh
docker compose up db -d          # exposes nothing by default; add `ports: ['5432:5432']` to the db service
cd server && npm install && npm run dev
cd client && npm install && npm run dev   # http://localhost:5173, proxies /api to :8080
```

Both only accept connections from this computer. To share them on your network, start the server with `LISTEN_ADDRESS=0.0.0.0 npm run dev` and the client with `npm run dev -- --host`. (In Docker, `LISTEN_ADDRESS` is always `0.0.0.0` inside the container, and `BIND_ADDRESS` decides who can reach it.)

## Tests

The server has unit tests, and integration tests that run the whole app against PostGIS and GDAL, each test file in its own throwaway database. They use [Vitest](https://vitest.dev). To run them all in Docker:

```sh
docker compose run --rm --build test
docker compose run --rm --build test npm run test:cov   # with a coverage report
```

Locally, `cd server && npm test` runs them against `DATABASE_URL`, like the server; `npx vitest run test/unit` runs only the unit tests, which need no database or GDAL. `server/test/fixtures/make-fixtures.sh` rebuilds the archive fixtures.

## Base map tiles

Tiles come from `tile.openstreetmap.org`, which is fine for light personal use under the [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/). For anything heavier, point the client at another tile server when building:

```sh
docker compose build --build-arg VITE_TILES='https://your.tiles/{z}/{x}/{y}.png'
```
