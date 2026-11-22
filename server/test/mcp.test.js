// The MCP server at /mcp, through the MCP SDK's own client, as an assistant
// would use it: the tools it lists, a call, error results and the HTTP rules
// around it. What each tool does is tested in assistantTools.test.js.
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { collection, freshDatabase, point } from './helpers.js';

let db, server, base, client, registry;

before(async () => {
  db = await freshDatabase('spatial_test_mcp');
  registry = await import('../assistant/registry.js');
  const { createApp } = await import('../app.js');
  server = createApp({ clientDir: await mkdtemp(path.join(tmpdir(), 'spatial-client-')), allowedHosts: [] }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
});

after(async () => {
  await client.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await db.pool.end();
});

// A tool call's result, parsed from its JSON text.
async function call(name, args) {
  const result = await client.callTool({ name, arguments: args });
  assert.ok(!result.isError, result.content[0].text);
  return JSON.parse(result.content[0].text);
}

describe('MCP server', () => {
  test('it lists every tool, with hints on which change or delete things', async () => {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), registry.ASSISTANT_TOOLS.map((t) => t.name).sort());
    const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
    assert.equal(byName.get_map.annotations.readOnlyHint, true);
    assert.equal(byName.delete_layer.annotations.destructiveHint, true);
    assert.deepEqual(byName.buffer.inputSchema.required, ['layer']);
  });

  test('it sends the guide to working in the app as its instructions', () => {
    const instructions = client.getInstructions();
    assert.match(instructions, /describe_layer/);
  });

  test('a map made over MCP is in the app, with its layers', async () => {
    const { map } = await call('create_map', { name: 'From Claude' });
    const { layers: [layer] } = await call('add_features', { map_id: map.id, name: 'wells', geojson: collection([point(1, 2)]) });
    const res = await fetch(`${base}/api/maps/${map.id}/layers`);
    assert.deepEqual((await res.json()).map((l) => [l.id, l.name]), [[layer.id, 'wells']]);
  });

  test("an error the app expects reaches the model as an error result with the app's message", async () => {
    const result = await client.callTool({ name: 'get_map', arguments: { map_id: 999999 } });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /That map doesn't exist/);
  });

  test('arguments that break the schema are refused before the tool runs', async () => {
    const result = await client.callTool({ name: 'get_features', arguments: { layer_id: 'one' } });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /layer_id/);
  });

  test('a body over the JSON parser\'s usual 100 KB is accepted at /mcp', async () => {
    const { map } = await call('create_map', { name: 'Big' });
    const features = Array.from({ length: 3000 }, (_, i) => [point(i / 1000, 0), { note: 'x'.repeat(40) }]);
    const { layers: [layer] } = await call('add_features', { map_id: map.id, name: 'many', geojson: collection(...features) });
    assert.equal(layer.count, 3000);
  });
});

describe('MCP results and HTTP', () => {
  test('a result over the size limit is refused with what to do instead', async () => {
    const { callTool, MAX_RESULT_CHARS } = await import('../mcp/server.js');
    const tool = { run: async () => ({ text: 'x'.repeat(MAX_RESULT_CHARS) }) };
    const result = await callTool(tool, {}, {});
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /too big to send.*Ask for less/);
  });

  test("an unexpected error's message is hidden", async () => {
    const { callTool } = await import('../mcp/server.js');
    const result = await callTool({ run: async () => { throw new Error('SELECT secret'); } }, {}, {});
    assert.equal(result.isError, true);
    assert.doesNotMatch(result.content[0].text, /secret/);
  });

  test('GET and DELETE are refused, since there are no sessions', async () => {
    for (const method of ['GET', 'DELETE']) {
      assert.equal((await fetch(`${base}/mcp`, { method })).status, 405);
    }
  });

  test('a request from another website is refused', async () => {
    const res = await fetch(`${base}/mcp`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' }, body: '{}',
    });
    assert.equal(res.status, 403);
  });
});
