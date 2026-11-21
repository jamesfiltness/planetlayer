# Spatial Analysis

A self-hosted app for spatial analysis: as many maps as you like, each with an OpenStreetMap base map, your own layers stored in PostGIS, and seven analysis tools.

## Run it

```sh
npm start
```

This starts Docker Desktop if it isn't already running (on Linux it tells you to start the Docker service instead), makes sure your installation has its own database password, then runs `docker compose up --build`. Docker is all you need installed besides npm. Then open http://localhost:8080. Data is kept in the `data` volume; `docker compose down -v` starts clean.

The database password is made the first time you run `npm start` and kept in `.env`, which only you can read and git ignores. Every installation gets a different one, so no copy of this app has a password anyone else knows. If you'd rather choose it, put `DB_PASSWORD=…` in `.env` before the first start. (Installations from before this had a shared password; `npm start` gives yours its own.) Once `.env` exists, `docker compose` commands work on their own, without `npm start`.

The database schema is updated when the server starts. Upgrading from a version without multiple maps puts all your existing layers into one map called "My map".

### Sharing it on your network

By default only this computer can open the app. To let other devices on your network use it too:

```sh
BIND_ADDRESS=0.0.0.0 docker compose up --build
```

Then open `http://<this computer's IP>:8080` (or `http://<name>.local:8080`) on the other device. There are no logins, so anyone on that network can add, change and delete layers: only do this on a network you trust.

The app only answers to `localhost`, IP addresses and `.local` names, so other websites can't reach it through DNS tricks. To use another host name, list it: `ALLOWED_HOSTS=mybox,mybox.lan`. `APP_PORT=9000` changes the port.

## What it does

- **Maps:** the app opens on your list of maps, most recently edited first. Create one with **New map**; rename or delete one from its **⋯** menu. Deleting a map deletes its layers. Each map opens where you last left it, on any device.
- **Add layer:** click the **+** at the top of the Layers panel to upload GeoJSON, zipped Shapefile, KML, KMZ, GPX, GeoPackage, FlatGeobuf or TopoJSON (or drop the file on the map). Files are read with GDAL and reprojected to WGS84. A file with several layers, or mixed points, lines and areas, becomes several layers. A property whose values are all numbers written as text (such as `"pop_est": "23.5"`) is stored as numbers, so it can be filtered, styled and added up as numbers; empty text in it becomes empty. Text with a leading zero (`"007"`), a whole number of more than 15 digits, or any word, keeps the whole property as text, since it's probably a code or an ID. Layers imported before this was added keep their text: import the file again to convert them.
- **Layers:** the panel on the left lists the map's layers, each with a small picture: its shape (points, line or area) in the layer's colour, or a glimpse of its style (category colours, colour ramp or heatmap); hover over it for the style and property. Click the eye to hide or show a layer on the map. Hover over a layer and click the pencil to open it in the layer editor on the right, where the **Style** tab sets how the layer is drawn: a style type at the top, then its fill colour and opacity, outline colour and width, and overall opacity (changes show on the map as you make them, and are saved). The style types are **Single colour** (every feature alike), **Categories** (a colour for each of a property's 24 most common values, in a fixed palette, with grey for any other value and for none) and **Colour scale** (a smooth gradient along a choice of colour ramps, from a numeric property's lowest value to its highest) and, for points only, **Size** (circles sized by a numeric property, with their area in step with the value), **Heatmap** (points blurred into a heatmap, optionally weighted by a numeric property; zoomed out, its intensity is lowered to match how crowded the points get, so it doesn't turn solid red) and **Cluster** (nearby points grouped into one circle with their count; click a cluster to zoom in and split it). After choosing a type, pick the property it colours by; only properties that suit the type are offered. The editor's **⋯** menu deletes the layer.
- **Filter:** the layer editor's **Filter** tab shows only the features whose properties match conditions, such as `functional` *is one of* `not working`, or `install_year` *is at least* 2015. Each comparison suits the property's type (numbers, text or true/false), common values are suggested from the data, and several conditions can be matched all together or any one of them. Text comparisons ignore case. The filter is saved with the layer, and a funnel in the Layers panel marks a filtered layer with how many features it shows. **Save as new layer** copies the matching features into a layer of their own. The analysis tools use only the features a layer's filter lets through, so they work on what the map shows; a filtered layer is marked "(filtered)" in the tool's layer list and in the name of the layer it makes.
- **Analyse:** each tool reads layers from the open map and writes a new layer to it.

| Tool | What it does |
| --- | --- |
| Buffer | Area around each feature (optionally merged) |
| Intersect | The part of a layer inside an area layer |
| Subtract | The part of a layer outside an area layer |
| Dissolve | Merge lines or areas sharing a property value |
| Summarize within | For each area, how many features of another layer are in it (`count`) and, optionally, the sum, mean, minimum or maximum of one of their numeric properties (such as `pop_est_sum`). A point on a shared border counts for both areas; a line or area counts once, in the area holding its centre. Only values stored as numbers are added up |
| Centroid | A point at the centre of each shape |
| Combine | Two layers of the same shape as one |

Click a feature to see its properties.

## Layout

```
shared/spec.js          file formats, units and tool fields, used by both server and client
shared/filter.js        layer filters: their operators and what makes a condition valid
shared/limits.js        limits on map and layer names and on layer styles
shared/symbology.js     layer symbology: the style types, which layer shapes and properties each can use, and their settings
shared/colors.js        the category palette and colour ramps symbology draws with

server/index.js         startup: migrate the database, then listen
server/app.js           the Express app: middleware order, routers, client files, errors
server/http/            request guard (host names, cross-site writes), security headers, upload settings, errors
server/routes/          thin route handlers for /api/maps and /api/layers
server/maps.js          maps: list, create, rename, delete, save the view
server/layers.js        layers: create, list, restyle, delete, GeoJSON
server/symbology.js     checking a layer's symbology against its shape
server/import.js        importing a file into a map, all or nothing
server/importNumbers.js storing numbers written as text as numbers, on import
server/gdal.js          reading uploaded files with GDAL's command-line tools
server/layerFilter.js   saving a layer's filter, and saving its matching features as a new layer
server/filter/          filters: checking them, turning them into SQL, summarising a layer's properties
server/tools.js         running an analysis tool on the features each picked layer's filter lets through
server/toolSql.js       each analysis tool's SQL, in PostGIS
server/summarize.js     the Summarize within tool's SQL
server/migrations/      schema, applied in order when the server starts
server/test/            integration tests against PostGIS and GDAL

client/src/main.jsx     routes: / (list of maps), /maps/:mapId (one map)
client/src/pages/       one component per route
client/src/components/  UI pieces: toolbar, layers panel, layer editor and its Style and Filter tabs, tool form, modals, ⋯ menu, list row
client/src/map/         MapLibre: base style, keeping the map in step with the layers, feature popups, saving the view
client/src/map/renderers/  how each symbology type is drawn, as MapLibre style layers
client/src/hooks/       state for a map's layers, saving their styles and filters, property summaries, and the status banner
client/src/api.js       calls to the server API
```

The client is React with MapLibre, styled with [Tailwind CSS](https://tailwindcss.com) (theme in `client/src/style.css`). Menus and modals use [Headless UI](https://headlessui.com) for keyboard and screen-reader support.

## API

The client uses this JSON API; errors come back as `{ "error": "message" }` with a 4xx or 5xx status.

Names, of maps and of new layers, can be at most 200 characters (`shared/limits.js`).

| Method | Path | Does |
| --- | --- | --- |
| GET | `/api/maps` | Every map, most recently edited first, with `layer_count` and its saved `view` (null until moved) |
| POST | `/api/maps` | Create a map: `{ "name": "…" }` |
| GET | `/api/maps/:id` | One map |
| PATCH | `/api/maps/:id` | Rename a map: `{ "name": "…" }` |
| PUT | `/api/maps/:id/view` | Save where the map was left: `{ "center": [lng, lat], "zoom": …, "bearing": …, "pitch": … }` (bearing and pitch optional) |
| DELETE | `/api/maps/:id` | Delete a map and its layers |
| GET | `/api/maps/:id/layers` | The map's layers, each with its `style`, `filter` (or null), feature `count`, how many match the filter (`matching`), property names (`fields`) and the box around its features as `[west, south, east, north]` (`extent`, or null) |
| POST | `/api/maps/:id/import` | Import a file (multipart field `file`) into the map |
| POST | `/api/maps/:id/tools/:tool` | Run a tool on the map's layers (fields as in `shared/spec.js`, plus an optional `name` for the new layer) |
| PUT | `/api/layers/:id/style` | Restyle a layer: `{ "fillColor": "#rrggbb", "fillOpacity": 0–1, "outlineColor": "#rrggbb", "outlineWidth": 0–10, "opacity": 0–1, "symbology": { "type": "single" } }` (all required; a line layer ignores the fill). The symbology can instead be `{ "type": "categories", "field": "…", "categories": [{ "value": …, "color": "#rrggbb" }] }` (at most 24) or `{ "type": "scale", "field": "…", "ramp": "viridis", "min": n, "max": n }`, or for points `{ "type": "size", "field": "…", "min": n, "max": n, "minSize": 1–40, "maxSize": 1–40 }`, `{ "type": "heatmap", "field": null, "radius": 2–60, "intensity": 0.1–5 }` (or with a `field` and its `min` and `max`) or `{ "type": "cluster", "radius": 10–100 }`; its type must be one the layer's shape allows (see `shared/symbology.js`) |
| PUT | `/api/layers/:id/filter` | Set a layer's filter: `{ "filter": { "match": "all" \| "any", "conditions": [{ "field", "op", "value" }] } }`, or `{ "filter": null }` for none (operators in `shared/filter.js`). The whole body can be at most 48 KB. Returns `{ "matching": n }` |
| GET | `/api/layers/:id/fields` | Every property of the layer's features, with its type, number range and most common values |
| POST | `/api/layers/:id/filtered` | Save the features matching `{ "filter": …, "name": "…" }` (name optional) as a new layer in the same map |
| DELETE | `/api/layers/:id` | Delete a layer |
| GET | `/api/layers/:id/geojson` | A layer's features as GeoJSON (only those its filter lets through) |

## Developing without Docker for the app

Run only the database in Docker, and the server and client locally (the server needs GDAL 3.11 or later, for the `gdal`, `ogr2ogr` and `ogrinfo` commands):

```sh
docker compose up db -d          # exposes nothing by default; add `ports: ['127.0.0.1:5432:5432']` to the db service
cd server && npm install && DATABASE_URL=postgres://spatial:$DB_PASSWORD@localhost:5432/spatial npm run dev
cd client && npm install && npm run dev   # http://localhost:5173, proxies /api to :8080
```

`DB_PASSWORD` is the one in `.env` (run `npm start` once, or `node scripts/ensure-env.mjs`, to make it). Keep the `127.0.0.1:` in the port: without it Docker publishes the database to your whole network, and on Linux it gets past the firewall too.

Both only accept connections from this computer. To share them on your network, start the server with `LISTEN_ADDRESS=0.0.0.0 npm run dev` and the client with `npm run dev -- --host`. (In Docker, `LISTEN_ADDRESS` is always `0.0.0.0` inside the container, and `BIND_ADDRESS` decides who can reach it.)

## Tests

The tests run against PostGIS and GDAL, each test file in its own throwaway database. With the app running in Docker:

```sh
docker compose exec app npm test
```

(Locally, `cd server && npm test` needs `DATABASE_URL`, like the server.) `server/test/fixtures/make-fixtures.sh` rebuilds the archive fixtures.

The client's tests run without Docker: `cd client && npm test`. To check the code for mistakes, run `npm install` once in the top folder, then `npm run lint`. GitHub runs all three on every pull request (`.github/workflows/ci.yml`).

## Base map

The base map comes from [OpenFreeMap](https://openfreemap.org/): OpenStreetMap data as vector tiles, free to use with no API key or sign-up.

OpenFreeMap is the only other site the app talks to: opening a map fetches its style and tiles from there, so OpenFreeMap sees your IP address and the area you're looking at. Your layers never leave your computer, and the app's fonts are bundled with it.

Choose a base map in **Settings → Theme**. Each theme is one of OpenFreeMap's styles: Light (Positron, the default), Bright, Liberty, Dark and Fiord. The dark ones also switch the rest of the app to dark. The list lives in `shared/themes.js`; the colours for light and dark are in `client/src/theme.css`.
