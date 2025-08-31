# Spatial Analysis

A small, self-hosted map for spatial analysis: an OpenStreetMap base map, your own layers stored in PostGIS, and seven analysis tools.

## Run it

```sh
docker compose up --build
```

Then open http://localhost:8080. Data is kept in the `data` volume; `docker compose down -v` starts clean.

## What it does

- **Add layer:** upload GeoJSON, zipped Shapefile, KML, KMZ, GPX, GeoPackage, FlatGeobuf or TopoJSON (or drop the file on the map). Files are read with GDAL and reprojected to WGS84. A file with several layers, or mixed points, lines and areas, becomes several layers.
- **Analyse:** each tool writes a new layer.

| Tool | What it does |
| --- | --- |
| Buffer | Area around each feature (optionally merged) |
| Intersect | The part of a layer inside an area layer |
| Subtract | The part of a layer outside an area layer |
| Dissolve | Merge lines or areas sharing a property value |
| Count points | Number of points inside each area |
| Centroid | A point at the centre of each shape |
| Combine | Two layers of the same shape as one |

Click a feature to see its properties.

## Layout

```
db/init.sql      schema: layers + features (geometry, 4326)
server/          Express: routes (index.js), GDAL import (import.js), PostGIS tools (tools.js)
client/          React + MapLibre: map (App.jsx), bottom toolbar (Toolbar.jsx), tool forms (ToolDialog.jsx)
```

## Developing without Docker for the app

Run only the database in Docker, and the server and client locally (the server needs GDAL's `ogr2ogr`/`ogrinfo` and `unzip` on the path):

```sh
docker compose up db -d          # exposes nothing by default; add `ports: ['5432:5432']` to the db service
cd server && npm install && npm run dev
cd client && npm install && npm run dev   # http://localhost:5173, proxies /api to :8080
```

## Base map tiles

Tiles come from `tile.openstreetmap.org`, which is fine for light personal use under the [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/). For anything heavier, point the client at another tile server when building:

```sh
docker compose build --build-arg VITE_TILES='https://your.tiles/{z}/{x}/{y}.png'
```
