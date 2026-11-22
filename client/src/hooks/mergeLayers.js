/**
 * The layer list after loading it from the server again, given the list on
 * screen: the server's list, with four things carried over from the screen.
 *
 * - Each layer keeps its client-only `revision`, so the map doesn't fetch
 *   features that haven't changed. It's bumped when the layer's filter or
 *   feature count has changed, as when an assistant filters a layer, or its
 *   features were changed in place (its `data_version` went up), so the
 *   map fetches them then.
 * - A layer whose style is still being saved keeps the style on screen,
 *   which is newer than the server's.
 * - Likewise a layer whose filter is still being saved keeps its filter and
 *   `matching` (null until that save says how many match).
 * - A layer just shown or hidden keeps that until the save is done.
 *
 * @param {object[]} loaded the layers as the server lists them
 * @param {object[]} current the layers on screen
 * @param {{ styleSaving: (id: number) => boolean, filterSaving: (id: number) => boolean,
 *   visibilitySaving?: (id: number) => boolean }} saving whether a layer has
 *   a save of that kind waiting or under way
 */
export function mergeLayers(loaded, current, { styleSaving, filterSaving, visibilitySaving = () => false }) {
  const onScreen = new Map(current.map((layer) => [layer.id, layer]));
  return loaded.map((layer) => {
    const shown = onScreen.get(layer.id);
    if (!shown) return { ...layer, revision: 0 };

    const merged = { ...layer, revision: shown.revision };
    if (styleSaving(layer.id)) merged.style = shown.style;
    if (visibilitySaving(layer.id)) merged.visible = shown.visible;
    if (filterSaving(layer.id)) {
      merged.filter = shown.filter;
      merged.matching = shown.matching;
    } else if (JSON.stringify(layer.filter) !== JSON.stringify(shown.filter) || layer.count !== shown.count
      || layer.data_version !== shown.data_version) {
      merged.revision += 1;
    }
    return merged;
  });
}
