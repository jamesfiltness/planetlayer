// What every assistant is told up front about how analysis is done in this
// app, on top of what the tools can do. It lives in instructions.md, so it
// reads as prose and can be edited without touching code. The MCP server
// sends it as its instructions.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const FILE = path.join(import.meta.dirname, 'instructions.md');

/** The assistant's instructions, as Markdown. */
export const assistantInstructions = () => readFile(FILE, 'utf8');
