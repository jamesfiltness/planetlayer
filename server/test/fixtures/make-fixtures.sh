#!/bin/sh
# Rebuilds the archive fixtures. Needs GDAL's ogr2ogr and zip.
set -eu
cd "$(dirname "$0")"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

cat > "$work/areas.geojson" <<'EOF'
{"type":"FeatureCollection","features":[
{"type":"Feature","properties":{"name":"A"},"geometry":{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,1],[0,0]]]}},
{"type":"Feature","properties":{"name":"B"},"geometry":{"type":"Polygon","coordinates":[[[1,0],[2,0],[2,1],[1,1],[1,0]]]}}]}
EOF
cat > "$work/points.geojson" <<'EOF'
{"type":"FeatureCollection","features":[
{"type":"Feature","properties":{"name":"p1"},"geometry":{"type":"Point","coordinates":[0.5,0.5]}},
{"type":"Feature","properties":{"name":"p2"},"geometry":{"type":"Point","coordinates":[1.5,0.5]}},
{"type":"Feature","properties":{"name":"p3"},"geometry":{"type":"Point","coordinates":[5,5]}}]}
EOF
# Metres, as if from a projected CRS whose .prj went missing.
cat > "$work/projected.geojson" <<'EOF'
{"type":"FeatureCollection","features":[
{"type":"Feature","properties":{"name":"far"},"geometry":{"type":"Point","coordinates":[500000,4000000]}}]}
EOF

# nested.zip: shapefiles in subfolders, as many downloads are laid out.
mkdir -p "$work/nested/data/deeper"
ogr2ogr "$work/nested/data/areas.shp" "$work/areas.geojson"
ogr2ogr "$work/nested/data/deeper/points.shp" "$work/points.geojson"
rm -f nested.zip && (cd "$work/nested" && zip -qr - .) > nested.zip

# half-bad.zip: one good shapefile and one without a .prj in metres.
mkdir -p "$work/half"
ogr2ogr "$work/half/areas.shp" "$work/areas.geojson"
ogr2ogr "$work/half/projected.shp" "$work/projected.geojson"
rm "$work/half/projected.prj"
rm -f half-bad.zip && (cd "$work/half" && zip -qr - .) > half-bad.zip

# places.kmz: a zipped KML.
ogr2ogr -f KML "$work/doc.kml" "$work/points.geojson"
rm -f places.kmz && (cd "$work" && zip -q - doc.kml) > places.kmz
