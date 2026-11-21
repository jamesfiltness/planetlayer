# Plan: spatial tools over MCP + an in-app agent with its own loop

> **Status:** not started. Written before the Filter tab, the Style tab's colour-by-value styles and
> Summarize within existed, so the "Gaps found by walking through a real question" section is out of
> date: those gaps are now closed in the app, and the agent's tools should wrap them.

## Context

Today the app is only usable through its UI. The goal is an AI agent that can
create maps, load data, run the spatial tools and explain the results, in two forms
built on one set of tools:

- **Power users** connect their own Claude (Code or Desktop) to the app's **MCP
  server**; their assistant is the agent.
- **Everyone else** gets an **agent inside the app**: a chat panel beside the map,
  driven by our own execution loop (model call → run tools → append results →
  repeat until the model answers in text), as described in the
  [agent execution loop](https://newsletter.victordibia.com/p/the-agent-execution-loop-how-to-build) article.

Everything runs locally in the existing Docker setup. The only thing that leaves the
machine is the in-app agent's calls to the Claude API.

## Decisions

1. **The MCP server is local, served by the app itself** at `http://localhost:8080/mcp`.
   The tools need PostGIS and GDAL, which live in the containers, so the server
   must run where they do. No hosted server and no npm package: it's **HTTP only**.
   The user runs `npm start` first, then Claude connects by URL. While the app is
   down, Claude's tools are unavailable, and the README says so.
2. **One tool registry, two front ends.** Each tool is a plain module: name,
   description, zod input schema, read-only/destructive flags, `handler(ctx, args)`.
   The MCP adapter and the agent loop both read the registry. The loop calls
   handlers directly (same process), so it isn't slowed down by the protocol, and it
   can have extra tools that only make sense in the app, such as "zoom the map to
   this layer". Both front ends see the same tool names, schemas and descriptions.
3. **Our own loop on the Anthropic TypeScript SDK (Messages API), not the Claude
   Agent SDK.** The Agent SDK is Claude Code as a library. Its built-in file and bash
   tools would all have to be turned off here, and it's a heavier dependency in the
   container. A hand-written loop is about 200 lines. It gives full control over
   streaming steps to the chat panel, pausing for confirmation before destructive
   tools, and keeping geometry out of the context, and it's readable for an
   open-source project. Server-side compaction (beta in the Messages API) is
   available later without switching.
4. **Spatial analysis tools are generated from `shared/spec.js` `TOOLS`**, so a
   new tool added to the spec is available in the UI, MCP and the agent at once.
5. **Uploads never pass through the model.** In the app, a file dropped into the chat
   goes through the existing import and the model gets a summary (layers, counts,
   fields). For MCP users: `add_features` for inline data (GeoJSON, or rows with
   lon/lat columns) and `import_file` from a mounted `./imports` folder for
   large files.
6. **Results are summaries.** `describe_layer` (counts, bbox, per-field
   type/distinct/min/max/samples) and paginated `get_features` (properties only by
   default, sortable). There's no raw SQL tool.
7. **Live map.** An in-process event bus plus Server-Sent Events, so the map
   refreshes whenever the agent, an MCP client or the UI changes it.

## Gaps found by walking through a real question

Question: "which broken water wells are most worth fixing, by people who'd benefit?"
The Uganda samples match it: `water-pumps` has `functional: working|broken`,
`settlement-areas` has `pop_est` (stored as a **string**), plus 3 districts. The
method: take broken pumps → draw a catchment around each → take settlement
population not already within reach of a working pump → add up the population per
catchment → rank → show. The seven current tools can't do it:

- **`filter`** (new spec tool): keep features where a property `=`, `≠`, `<`, `>` or
  `in` a value. Needed to split broken from working pumps.
- **`summarize`** (new spec tool): for each area, count, sum, mean, min or max of a
  field of another layer's features inside it (by intersection or centroid).
  Numeric strings are cast, and non-numbers are skipped and counted. `count` stays
  as the simple case.
- **Graduated styling** (`style_layer` with `byField` and colour ramp): so the
  ranking is visible on the map. It can come after the rest.

Both new tools go in `shared/spec.js`, so the UI gets them too.

## Guidance (playbooks), on top of the tools

The model knows catchment analysis in general. A short guide makes it consistent
with this app: describe layers first, check the actual values ("broken" vs
"Non-Functional"), state the assumptions it makes (catchment distance), exclude
people already served, warn about counting the same people twice where catchments
overlap, and name result layers clearly. Tools supply what it can do; guides tell it
how this kind of analysis is done here.

- One source: `server/agent/playbooks/*.md`, starting with just two: `general.md`
  (always loaded) and `facility-prioritisation.md` (this question). Add more only
  when a test conversation shows the agent getting a kind of task wrong.
- In-app agent: `general.md` goes in the system prompt. Others are listed by name
  and one-line summary and loaded with a `read_playbook` tool when needed, the same
  load-on-demand approach skills use, so the system prompt stays small.
- MCP: `general.md` becomes the server's `instructions`; every playbook is also
  served as an MCP prompt and resource, so Claude Code/Desktop users get the same
  guidance without installing a skill.

## Tools (registry)

| Group | Tools |
| --- | --- |
| Maps | `list_maps`, `create_map`, `rename_map`, `get_map` |
| Layers | `list_layers`, `describe_layer`, `get_features`, `rename_layer`, `style_layer`, `delete_layer` (destructive) |
| Data in | `add_features` (inline, optional `layerId` to append), `import_file`, `list_import_files` |
| Analysis | generated: `buffer`, `intersect`, `subtract`, `dissolve`, `count`, `centroid`, `combine`, + new `filter`, `summarize` |
| Guidance | `read_playbook` (in-app); playbooks as MCP prompts/resources |
| App-only (agent) | `focus_layer` (zoom/show), the open map's id and visible layers given as context |

## The loop (`server/agent/`)

- `loop.js`: `runTurn({ conversation, userMessage, onEvent })`. It streams
  `client.messages.stream` with `model: "claude-opus-5-5"`, adaptive thinking
  and explicit `effort` (the model's default is `medium`). On `tool_use` it validates
  the input against the zod schema, runs every tool call in the response, and
  returns all `tool_result`s in one user message. Errors come back as
  `is_error: true` results, not thrown. It stops on `end_turn`, and caps turns
  (e.g. 25) to bound cost. It handles `max_tokens` and `refusal`, plus `fallbacks`
  as the API guidance for this model recommends.
- `confirm.js`: destructive tools pause the turn and emit a `confirm` event. The chat
  panel shows Approve/Deny, and the answer resumes the loop.
- `prompt.js`: a stable system prompt (spatial know-how, tool conventions, units),
  with the per-turn map context appended after the cached prefix. Prompt caching is
  on for the system prompt and tools.
- `conversations.js` plus migration `006_conversations.sql`: one conversation per
  map, messages stored as the SDK's content blocks (kept unchanged, including
  thinking blocks).
- `route.js`: `POST /api/maps/:id/chat` streams events (text deltas, tool started or
  finished, confirm, done) as SSE. `GET` returns the history.
- Key: `ANTHROPIC_API_KEY` is passed from the host in `docker-compose.yml`. Without
  it, the chat panel explains how to set it and everything else works as before.

## Files

New: `server/tools/registry.js`, `server/tools/{maps,layers,data,analysis}.js`,
`server/tools/fromSpec.js`, `server/features.js` (describe/get/rename),
`server/importFolder.js`, `server/events.js`, `server/routes/events.js`,
`server/mcp/{endpoint,server}.js`, `server/agent/{loop,confirm,prompt,conversations,route}.js`,
`server/migrations/006_conversations.sql`, `client/src/components/ChatPanel.jsx`
(+ `ChatMessage.jsx`, `ToolStep.jsx`), `client/src/hooks/{useChat,useMapEvents}.js`.

Changed: `server/app.js` (mount `/mcp`, chat, events), `server/import.js` (append to an
existing layer), `server/layers.js` (`touchMap` emits a change event), `shared/spec.js`
(`.csv`), `server/package.json` (`@anthropic-ai/sdk`, `@modelcontextprotocol/sdk`,
`zod`), `docker-compose.yml` (imports mount, API key), `client/src/pages/MapPage.jsx`,
`client/src/hooks/useMapLayers.js`, `README.md`.

Reused: `runTool` (`server/tools.js`), `importFile` (`server/import.js`), the
maps/layers domain functions, `parseId`/`parseStyle`, `hostGuard` (covers `/mcp` and chat).

## Phases (one PR each)

0. `filter` and `summarize` spec tools (UI + SQL + tests). Useful on their own.
1. Tool registry + read tools + `describe_layer`/`get_features`, with tests.
2. MCP adapter at `/mcp`, generated analysis tools; Claude Code connects with
   `claude mcp add --transport http spatial http://localhost:8080/mcp`.
3. Data in: CSV, append, `add_features`, `import_file` + mount; live map events.
4. Agent loop + chat route + conversations table (tested with a stubbed client).
5. Chat panel UI: streaming steps, confirmations, file drop into chat.
6. Docs ("start the app, then connect Claude"; how to connect Claude Desktop to a
   localhost HTTP server, still to verify against current Desktop docs), prompt
   tuning with the Uganda samples.

## Verification

- `npm test`: registry handlers against PostGIS; MCP via the SDK `Client` on a spare
  port (lists tools, schemas match `TOOLS`, `add_features` → `buffer` → `count`);
  `import_file` refuses `../`, absolute and symlinked paths; `/mcp` refuses
  cross-site `Origin`.
- Loop tests with a fake Messages client that scripts tool calls: results are
  returned together, errors become `is_error`, the turn cap stops runaway loops, and
  destructive tools wait for confirmation.
- Main test scenario: `npm start` with `ANTHROPIC_API_KEY` set. In the chat panel,
  drop the three Uganda files and ask "show me the broken water pumps most worth
  fixing, by how many people would benefit". Pass means: it filters broken pumps,
  buffers them, removes people already served by working pumps, sums `pop_est`,
  ranks, styles the result, and states its assumptions. Watch the layers appear live. Repeat the same request from Claude
  Code over MCP.
- Check current SDK APIs (`@modelcontextprotocol/sdk` stateless transport, Anthropic
  TS SDK streaming/tool types) before phases 2 and 4.
