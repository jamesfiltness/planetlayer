// Tools for maps: listing, creating, renaming and opening one.
import * as z from 'zod';
import { listLayers } from '../../layers.js';
import { createMap, getMap, listMaps, renameMap } from '../../maps.js';
import { MAX_MAP_NAME } from '../../../shared/limits.js';
import { mapId } from '../schemas.js';
import { layerSummary, mapSummary } from '../summaries.js';

const mapName = z.string().describe(`The map's name, at most ${MAX_MAP_NAME} characters.`);

export const mapTools = [
  {
    name: 'list_maps',
    title: 'List maps',
    description: 'Lists every map in the app, most recently edited first, with its id and how many layers it has.',
    input: {},
    readOnly: true,
    run: async () => ({ maps: (await listMaps()).map(mapSummary) }),
  },
  {
    name: 'get_map',
    title: 'Open a map',
    description:
      'Gets a map and its layers. Each layer has its id, shape (point, line or polygon), feature count, '
      + 'how many features its filter lets through (`matching`; the map shows only those, and the analysis tools use only those), '
      + 'its filter, some of its property names, its extent as [west, south, east, north] and its style. '
      + 'Use describe_layer to see a layer\'s properties in full.',
    input: { map_id: mapId },
    readOnly: true,
    run: async ({ map_id }) => {
      const map = await getMap(map_id);
      return { map: mapSummary(map), layers: (await listLayers(map.id)).map(layerSummary) };
    },
  },
  {
    name: 'create_map',
    title: 'Create a map',
    description: 'Creates a new, empty map and returns it. Add data to it with upload_file or add_features.',
    input: { name: mapName },
    run: async ({ name }) => ({ map: mapSummary(await createMap(name)) }),
  },
  {
    name: 'rename_map',
    title: 'Rename a map',
    description: 'Renames a map.',
    input: { map_id: mapId, name: mapName },
    run: async ({ map_id, name }) => ({ map: mapSummary(await renameMap(map_id, name)) }),
  },
];
