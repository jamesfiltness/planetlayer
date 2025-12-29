# Spatial Analysis

A small, self-hosted map for spatial analysis: an OpenStreetMap base map, your own layers stored in PostGIS, and seven analysis tools.

## Run it

```sh
docker compose up --build
```

Then open http://localhost:8080. Data is kept in the `data` volume; `docker compose down -v` starts clean.

### Sharing it on your network

By default only this computer can open the app. To let other devices on your network use it too:

```sh
BIND_ADDRESS=0.0.0.0 docker compose up --build
```

Then open `http://<this computer's IP>:8080` (or `http://<name>.local:8080`) on the other device. There are no logins, so anyone on that network can add, change and delete layers: only do this on a network you trust.

The app only answers to `localhost`, IP addresses and `.local` names, so other websites can't reach it through DNS tricks. To use another host name, list it: `ALLOWED_HOSTS=mybox,mybox.lan`. `APP_PORT=9000` changes the port.

## What it does

- **Add layer:** upload GeoJSON, zipped Shapefile, KML, KMZ, GPX, GeoPackage, FlatGeobuf or TopoJSON (or drop the file on the map). Files are read with GDAL and reprojected to WGS84. A file with several layers, or mixed points, lines and areas, becomes several layers.
- **Analyse:** each tool writes a new layer.

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
shared/spec.js      file formats, units and tool fields, used by both server and client
server/            Express: routes (index.js), GDAL import (import.js), PostGIS tools (tools.js)
server/migrations/ schema, applied in order when the server starts
server/test/       integration tests against PostGIS and GDAL
client/            React + MapLibre: map (App.jsx), bottom toolbar (Toolbar.jsx), tool forms (ToolDialog.jsx)
```

## Developing without Docker for the app

Run only the database in Docker, and the server and client locally (the server needs GDAL 3.11 or later, for the `gdal`, `ogr2ogr` and `ogrinfo` commands):

```sh
docker compose up db -d          # exposes nothing by default; add `ports: ['5432:5432']` to the db service
cd server && npm install && npm run dev
cd client && npm install && npm run dev   # http://localhost:5173, proxies /api to :8080
```

Both only accept connections from this computer. To share them on your network, start the server with `LISTEN_ADDRESS=0.0.0.0 npm run dev` and the client with `npm run dev -- --host`. (In Docker, `LISTEN_ADDRESS` is always `0.0.0.0` inside the container, and `BIND_ADDRESS` decides who can reach it.)

## Tests

The tests run against PostGIS and GDAL, each test file in its own throwaway database. With the app running in Docker:

```sh
docker compose exec app npm test
```

(Locally, `cd server && npm test` uses `DATABASE_URL`, like the server.) `server/test/fixtures/make-fixtures.sh` rebuilds the archive fixtures.

## Base map tiles

Tiles come from `tile.openstreetmap.org`, which is fine for light personal use under the [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/). For anything heavier, point the client at another tile server when building:

```sh
docker compose build --build-arg VITE_TILES='https://your.tiles/{z}/{x}/{y}.png'
```
