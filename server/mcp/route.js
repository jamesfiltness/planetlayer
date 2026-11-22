// Serves the MCP server at /mcp over Streamable HTTP, so an assistant on
// this computer connects by URL:
//
//   claude mcp add --transport http spatial-analysis http://localhost:8080/mcp
//
// It's stateless: each POST gets a fresh server and transport, and nothing
// is kept between requests. The tools only need the database, so there's
// nothing a session would hold, and a restart of the app can't break a
// client's session. Without sessions there's nothing to stream to a client
// unprompted, so GET (which opens such a stream) and DELETE (which ends a
// session) are refused, as the protocol allows.
//
// app.js mounts this after the host guard, which also covers DNS rebinding
// for /mcp, and before its own JSON parser, since add_features can carry
// more than that parser's 100 KB default.
import express, { Router } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from './server.js';

/** The biggest request body /mcp accepts, which bounds add_features. */
export const MAX_MCP_BODY = '10mb';

export const mcpRouter = Router();

mcpRouter.post('/', express.json({ limit: MAX_MCP_BODY }), async (req, res) => {
  // The address the client used, so upload_file's command reaches the app
  // the same way, whatever port or host name it's on.
  const server = await createMcpServer({ baseUrl: `${req.protocol}://${req.get('host')}` });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => {
    transport.close();
    server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

const notAllowed = (req, res) => {
  res.status(405).set('Allow', 'POST').json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null });
};
mcpRouter.get('/', notAllowed);
mcpRouter.delete('/', notAllowed);
