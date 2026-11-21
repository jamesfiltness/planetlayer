// The MCP server: the assistant tools (assistant/registry.js) offered over
// the Model Context Protocol, so an assistant such as Claude Code can work
// on the app's maps. route.js serves it over HTTP.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describeError } from '../http/errorHandler.js';
import { ASSISTANT_TOOLS } from '../assistant/registry.js';
import { assistantInstructions } from '../assistant/tools/playbooks.js';

/**
 * The most characters a tool result can have. Every character of a result
 * goes into the model's context, and Claude Code warns about results much
 * bigger than this. A bigger result is refused with a message saying how to
 * ask for less, rather than cut short, so the model never works from part of
 * the data without knowing it.
 */
export const MAX_RESULT_CHARS = 40_000;

// Read once: the playbooks only change when the app is rebuilt.
let instructions;

/**
 * A new MCP server with every assistant tool. The route makes one for each
 * request, since it keeps no sessions.
 *
 * @param {{ baseUrl: string }} context passed to each tool's `run`
 */
export async function createMcpServer(context) {
  instructions ??= assistantInstructions();
  const server = new McpServer({ name: 'spatial-analysis', version: '1.0.0' }, { instructions: await instructions });
  for (const tool of ASSISTANT_TOOLS) {
    server.registerTool(tool.name, {
      title: tool.title,
      description: tool.description,
      inputSchema: tool.input,
      annotations: {
        title: tool.title,
        readOnlyHint: Boolean(tool.readOnly),
        destructiveHint: Boolean(tool.destructive),
        openWorldHint: false, // only this app's own data
      },
    }, (args) => callTool(tool, args, context));
  }
  return server;
}

/**
 * Runs a tool and returns its MCP result: the result as JSON text, or an
 * error result the model can read and act on. Errors the app expects
 * (missing layers, bad values) keep their message; anything else is logged
 * and replaced, as the HTTP API does, since its message may hold SQL.
 */
export async function callTool(tool, args, context) {
  let text;
  try {
    text = JSON.stringify(await tool.run(args, context));
  } catch (error) {
    const { message, expected } = describeError(error);
    if (!expected) console.error(error);
    return errorResult(message);
  }
  if (text.length > MAX_RESULT_CHARS) {
    return errorResult(`That result is too big to send (${text.length} characters, the most is ${MAX_RESULT_CHARS}). `
      + 'Ask for less: fewer features per page, only the properties you need, or less geometry.');
  }
  return { content: [{ type: 'text', text }] };
}

const errorResult = (message) => ({ content: [{ type: 'text', text: message }], isError: true });
