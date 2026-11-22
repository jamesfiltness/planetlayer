// Duplicating a map: a new, independent map with its own copy of every layer
// and feature, so editing or deleting either map never affects the other.
import { transaction } from './db.js';
import { notFound } from './errors.js';
import { getMap } from './maps.js';
import { parseId, parseMapName } from './validation.js';

// Everything about a layer except its id and map. A column added to `layers`
// must be added here too, or copies will lose it (and get its default).
const LAYER_COLUMNS = `name, shape, fill_color, fill_opacity, outline_color, outline_width, opacity, filter, symbology, visible`;

/**
 * Copies the map `id` to a new map called `name`, with the same saved view
 * and a copy of each layer (style, filter and features included) in the same
 * order. The copy is new, so it's the most recently edited map.
 *
 * Runs in one transaction, so a copy is either complete or never appears.
 *
 * @param {number | string} id the map to copy
 * @param {unknown} name the copy's name, checked like any map name
 * @returns the new map, as getMap gives it
 */
export async function duplicateMap(id, name) {
  const sourceId = parseId(id);
  const copyName = parseMapName(name);
  const copyId = await transaction(async (db) => {
    // FOR SHARE stops the source map, and so its layers, being deleted
    // until the copy is made. Edits to it can still happen, but will wait
    // for, or be waited on by, the copy.
    const { rows: [source] } = await db.query('SELECT id FROM maps WHERE id = $1 FOR SHARE', [sourceId]);
    if (!source) throw notFound("That map doesn't exist. It may have been deleted.");

    const { rows: [{ id: newId }] } = await db.query(
      `INSERT INTO maps (name, view_lng, view_lat, view_zoom, view_bearing, view_pitch)
       SELECT $2, view_lng, view_lat, view_zoom, view_bearing, view_pitch FROM maps WHERE id = $1
       RETURNING id`,
      [sourceId, copyName],
    );

    // One layer at a time, in id order, so the copies keep the originals'
    // order (layers are listed by id) and each copy's features know its id.
    const { rows: layers } = await db.query('SELECT id FROM layers WHERE map_id = $1 ORDER BY id FOR SHARE', [sourceId]);
    for (const layer of layers) {
      const { rows: [{ id: layerId }] } = await db.query(
        `INSERT INTO layers (map_id, ${LAYER_COLUMNS})
         SELECT $2, ${LAYER_COLUMNS} FROM layers WHERE id = $1 RETURNING id`,
        [layer.id, newId],
      );
      await db.query(
        `INSERT INTO features (layer_id, geom, props)
         SELECT $2, geom, props FROM features WHERE layer_id = $1 ORDER BY id`,
        [layer.id, layerId],
      );
    }
    return newId;
  });
  return getMap(copyId);
}
