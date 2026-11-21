// Every tool an AI assistant can use on the app, in one list. The MCP server
// (server/mcp/) offers them to assistants such as Claude Code; an assistant
// built into the app can later use the same list, so both see the same
// names, descriptions and arguments.
//
// Each tool is a plain object:
//
// - `name`: what the model calls it, in snake_case.
// - `title`: a short name for people, shown by some clients.
// - `description`: for the model: what the tool does, when to use it and
//   what it gives back. This is most of what the model knows about the
//   tool, so it's written with care.
// - `input`: the arguments, as a zod object shape. The MCP SDK checks
//   arguments against it before `run` is called, and turns it into the JSON
//   Schema the model sees, `.describe()` texts included.
// - `readOnly`: true if it changes nothing. `destructive`: true if it
//   deletes something. Clients use these to decide what to ask the user
//   before running.
// - `run(args, context)`: does the work and resolves to a JSON-able result.
//   `context.baseUrl` is the address the client reached the app at, such as
//   http://localhost:8080. Errors made with badRequest or notFound (see
//   errors.js) are shown to the model, so their messages should say what to
//   do instead; any other error is treated as a bug and hidden.
//
// Results are kept small: a model pays for every token of a result, and
// some clients refuse large ones. Tools return ids and summaries, and the
// data itself only when asked (get_features), a page at a time.
import { analysisTools } from './tools/analysis.js';
import { dataTools } from './tools/data.js';
import { filterTools } from './tools/filter.js';
import { inspectTools } from './tools/inspect.js';
import { layerTools } from './tools/layers.js';
import { mapTools } from './tools/maps.js';
import { playbookTools } from './tools/playbooks.js';
import { styleTools } from './tools/style.js';

/** @type {Array<{ name: string, title: string, description: string, input: object, readOnly?: boolean, destructive?: boolean, run: Function }>} */
export const ASSISTANT_TOOLS = [
  ...playbookTools,
  ...mapTools,
  ...layerTools,
  ...inspectTools,
  ...dataTools,
  ...filterTools,
  ...styleTools,
  ...analysisTools,
];
