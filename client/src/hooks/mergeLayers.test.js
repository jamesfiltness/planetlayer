// What mergeLayers keeps from the screen when the layers are loaded again.
import { describe, expect, test } from 'vitest';
import { mergeLayers } from './mergeLayers.js';

const layer = (id, changes = {}) => ({ id, name: `Layer ${id}`, count: 3, matching: 3, filter: null, style: { fillColor: '#111111' }, ...changes });
const nothingSaving = { styleSaving: () => false, filterSaving: () => false };
const filter = { match: 'all', conditions: [{ field: 'status', op: 'eq', value: 'broken' }] };

describe('mergeLayers', () => {
  test("takes the server's list, so new layers appear and deleted ones go", () => {
    const merged = mergeLayers([layer(1), layer(3)], [layer(1, { revision: 2 }), layer(2, { revision: 0 })], nothingSaving);
    expect(merged.map((l) => [l.id, l.revision])).toEqual([[1, 2], [3, 0]]);
  });

  test("takes changes made elsewhere, such as a new name or style", () => {
    const [merged] = mergeLayers([layer(1, { name: 'Wells', style: { fillColor: '#222222' } })], [layer(1, { revision: 0 })], nothingSaving);
    expect([merged.name, merged.style.fillColor, merged.revision]).toEqual(['Wells', '#222222', 0]);
  });

  test('bumps the revision when the filter or the feature count changed, so the features are fetched again', () => {
    const [filtered] = mergeLayers([layer(1, { filter, matching: 1 })], [layer(1, { revision: 4 })], nothingSaving);
    expect([filtered.revision, filtered.matching]).toEqual([5, 1]);
    const [grown] = mergeLayers([layer(1, { count: 9 })], [layer(1, { revision: 4 })], nothingSaving);
    expect(grown.revision).toBe(5);
  });

  test('keeps a style or filter still being saved, as it is newer than the server\'s', () => {
    const shown = layer(1, { revision: 1, style: { fillColor: '#999999' }, filter, matching: null });
    const [merged] = mergeLayers([layer(1)], [shown], { styleSaving: (id) => id === 1, filterSaving: (id) => id === 1 });
    expect([merged.style.fillColor, merged.filter, merged.matching, merged.revision]).toEqual(['#999999', filter, null, 1]);
  });
});
