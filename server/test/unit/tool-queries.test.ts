import type { LayerRow } from '../../src/layers/layer.js';
import { TOOL_QUERIES } from '../../src/tools/tool-queries.js';
import { TOOLS } from '../../../shared/spec.js';

const layer = (id: number, shape: LayerRow['shape'], name = `layer ${id}`): LayerRow =>
  ({ id, map_id: 1, name, shape, color: '#000' });

describe('TOOL_QUERIES', () => {
  test('there is a query for every tool the client offers', () => {
    expect(Object.keys(TOOL_QUERIES).sort()).toEqual(TOOLS.map((tool) => tool.id).sort());
  });

  test('buffer converts the distance to metres and passes it as a parameter', () => {
    const query = TOOL_QUERIES.buffer({ layer: layer(3, 'point', 'wells') }, { distance: 2, unit: 'mi' });
    expect(query).toMatchObject({ name: 'wells buffer', shape: 'polygon', args: [3, 2 * 1609.344] });
  });

  test("dissolve passes the property name as a parameter, never in the SQL", () => {
    const field = "x'); DROP TABLE layers; --";
    const query = TOOL_QUERIES.dissolve({ layer: layer(1, 'polygon') }, { field });
    expect(query.args).toEqual([1, field]);
    expect(query.sql).not.toContain(field);
  });

  test('intersect and subtract keep the shape of the layer being cut', () => {
    const picked = { layer: layer(1, 'line'), areas: layer(2, 'polygon') };
    expect(TOOL_QUERIES.intersect(picked, {}).shape).toBe('line');
    expect(TOOL_QUERIES.subtract(picked, {}).shape).toBe('line');
  });
});
