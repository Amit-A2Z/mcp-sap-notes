#!/usr/bin/env node
// Tiny MCP client for debugging. It starts the stdio server the same way Claude does,
// calls one tool, prints a short summary and exits.
//
//   node scripts/mcp-stdio-client.mjs [--inspect] [--tool search|fetch] [query or note id]
//
// --inspect starts the server with the Node inspector on port 9230, so VS Code can attach.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const inspect = args.includes('--inspect');
const toolIdx = args.indexOf('--tool');
const tool = toolIdx >= 0 ? args[toolIdx + 1] : 'search';
const positional = args.filter((a, i) => !a.startsWith('--') && i !== toolIdx + 1);
const input = positional[0] ?? (tool === 'fetch' ? '2744792' : 'Cloud Integration externalized parameters');

const serverArgs = [
  'node',
  ...(inspect ? ['--inspect=9230'] : []),
  '--import', 'tsx',
  join(root, 'src/mcp-server.ts'),
];

// When VS Code launches this client it injects its own debugger hooks into NODE_OPTIONS.
// Remove them so the server only listens on the explicit --inspect port.
const { NODE_OPTIONS, VSCODE_INSPECTOR_OPTIONS, ...cleanEnv } = process.env;

const transport = new StdioClientTransport({
  command: join(root, 'scripts/debug-env.sh'),
  args: serverArgs,
  cwd: root,
  stderr: 'inherit',
  env: { ...cleanEnv, LOG_LEVEL: process.env.LOG_LEVEL ?? 'info' },
});
const client = new Client({ name: 'debug-client', version: '0.0.1' });

const started = Date.now();
await client.connect(transport);
const { tools } = await client.listTools();
console.log(`connected in ${Date.now() - started} ms, tools: ${tools.map((t) => t.name).join(', ')}`);

const callArgs = tool === 'fetch' ? { id: input } : { q: input };
console.log(`calling ${tool} ${JSON.stringify(callArgs)}`);
const t0 = Date.now();
const result = await client.callTool({ name: tool, arguments: callArgs });
console.log(`${tool} finished in ${Date.now() - t0} ms, isError=${Boolean(result.isError)}`);

const text = (result.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
console.log(text.split('\n').slice(0, 14).join('\n'));
console.log(`... (${text.length} chars total)`);

await client.close();
