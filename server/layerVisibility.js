// Showing and hiding a layer on the map. It's saved with the layer, so the
// eye in the Layers panel and the assistants' set_layer_visibility tool
// change the same setting, and a hidden layer stays hidden on reload.
//
// A hidden layer is only left off the map: the analysis tools still use it,
// as they use a layer however it's styled.
import { pool } from './db.js';
import { badRequest, notFound } from './errors.js';
import { touchMap } from './layers.js';
import { parseId } from './validation.js';

/**
 * Shows (`visible` true) or hides (false) a layer.
 *
 * @param {number | string} id
 * @param {unknown} visible must be exactly true or false
 */
export async function setLayerVisibility(id, visible) {
  // Strictly a boolean: the text "false" would otherwise read as true.
  if (typeof visible !== 'boolean') throw badRequest('Visible must be true or false.');
  const { rows: [layer] } = await pool.query('UPDATE layers SET visible = $2 WHERE id = $1 RETURNING map_id', [parseId(id), visible]);
  if (!layer) throw notFound('That layer no longer exists.');
  await touchMap(pool, layer.map_id);
}
