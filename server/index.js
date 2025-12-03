import express from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { rm } from 'node:fs/promises';
import { badRequest, migrate, pool } from './db.js';
import { importFile } from './import.js';
import { runTool } from './tools.js';

const app = express();
// GDAL picks a driver partly by extension, so the upload keeps its own.
const upload = multer({
  storage: multer.diskStorage({ filename: (req, file, cb) => cb(null, randomUUID() + path.extname(file.originalname)) }),
  limits: { fileSize: 500 * 1024 ** 2 },
});
const dist = path.join(import.meta.dirname, '../client/dist');

app.use(express.json());
app.use(express.static(dist));

app.get('/api/layers', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT l.*, count(f.id)::int AS count,
            array[min(ST_XMin(f.geom)), min(ST_YMin(f.geom)), max(ST_XMax(f.geom)), max(ST_YMax(f.geom))] AS bbox,
            (SELECT coalesce(array_agg(DISTINCT k), '{}') FROM (SELECT props FROM features WHERE layer_id = l.id LIMIT 100) s,
                    jsonb_object_keys(s.props) k) AS fields
     FROM layers l LEFT JOIN features f ON f.layer_id = l.id
     GROUP BY l.id ORDER BY l.id`,
  );
  res.json(rows);
});

app.delete('/api/layers/:id', async (req, res) => {
  await pool.query('DELETE FROM layers WHERE id = $1', [Number(req.params.id)]);
  res.end();
});

app.get('/api/layers/:id/geojson', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT json_build_object('type', 'FeatureCollection', 'features', coalesce(json_agg(json_build_object(
              'type', 'Feature', 'id', id, 'geometry', ST_AsGeoJSON(geom, 7)::json, 'properties', props)), '[]')) AS fc
     FROM features WHERE layer_id = $1`,
    [Number(req.params.id)],
  );
  res.json(rows[0].fc);
});

app.post('/api/import', upload.single('file'), async (req, res) => {
  if (!req.file) throw badRequest('No file uploaded.');
  try {
    res.json(await importFile(req.file));
  } finally {
    await rm(req.file.path, { force: true });
  }
});

app.post('/api/tools/:tool', async (req, res) => {
  res.json(await runTool(req.params.tool, req.body));
});

app.use((error, req, res, next) => {
  if (!error.status) console.error(error);
  res.status(error.status ?? 500).json({ error: error.message });
});

await migrate();

const port = process.env.PORT ?? 8080;
app.listen(port, () => console.log(`Spatial Analysis on http://localhost:${port}`));
