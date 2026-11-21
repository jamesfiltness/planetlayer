// Guides that tell a model how analysis is done in this app, on top of what
// the tools can do. They live in ../playbooks/ as Markdown.
//
// general.md applies to everything, so it's always sent: it's the MCP
// server's instructions (see assistantInstructions). The others are for
// particular kinds of question; the instructions list them, and the model
// reads one with read_playbook when it needs it, so only what's relevant
// takes up its context. Add a playbook when a test conversation shows the
// model getting a kind of task wrong, and list it in PLAYBOOKS.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import * as z from 'zod';

const DIR = path.join(import.meta.dirname, '../playbooks');

/** The playbooks besides general.md, each with when to read it. */
export const PLAYBOOKS = {
  'facility-prioritisation':
    'Ranking facilities (water points, clinics, schools) by how many people they serve or would serve, such as which broken pumps to fix first.',
};

const readPlaybook = (name) => readFile(path.join(DIR, `${name}.md`), 'utf8');

/** What every assistant is told up front: general.md, then the playbooks it can read. */
export async function assistantInstructions() {
  const list = Object.entries(PLAYBOOKS).map(([name, when]) => `- ${name}: ${when}`).join('\n');
  return `${await readPlaybook('general')}\nPlaybooks: step-by-step guides for particular kinds of analysis. `
    + `Read the one that fits with read_playbook before you start such a task.\n${list}\n`;
}

export const playbookTools = [
  {
    name: 'read_playbook',
    title: 'Read a playbook',
    description: 'Reads a step-by-step guide for a kind of analysis. Read the one that fits before starting such a task.\n'
      + Object.entries(PLAYBOOKS).map(([name, when]) => `- ${name}: ${when}`).join('\n'),
    input: { name: z.enum(Object.keys(PLAYBOOKS)) },
    readOnly: true,
    run: async ({ name }) => ({ name, playbook: await readPlaybook(name) }),
  },
];
