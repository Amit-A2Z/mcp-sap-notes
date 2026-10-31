#!/usr/bin/env node
// Calls an MCP server over Streamable HTTP. Works for the local server and for a Vercel URL.
//
//   node scripts/mcp-http-client.mjs [url] [query]
//
// Local default: http://localhost:3123/mcp, token from the file debug-env.sh writes.
// For a protected Vercel URL set VERCEL_BYPASS (the Protection Bypass for Automation secret).
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2] ?? 'http://localhost:3123/mcp';
const query = process.argv[3] ?? 'Cloud Integration externalized parameters';

const headers = {};
const tokenFile = join(process.env.SAP_DEBUG_DIR ?? join(homedir(), '.sap-mcp/vercel-debug'), 'http-access-token');
if (process.env.MCP_ACCESS_TOKEN) {
  headers.Authorization = `Bearer ${process.env.MCP_ACCESS_TOKEN}`;
} else {
  try {
    headers.Authorization = `Bearer ${readFileSync(tokenFile, 'utf8').trim()}`;
  } catch {
    console.log('no MCP_ACCESS_TOKEN and no local token file, sending no Authorization header');
  }
}
if (process.env.VERCEL_BYPASS) headers['x-vercel-protection-bypass'] = process.env.VERCEL_BYPASS;

const client = new Client({ name: 'debug-http-client', version: '0.0.1' });
await client.connect(new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers } }));
const { tools } = await client.listTools();
console.log(`tools: ${tools.map((t) => t.name).join(', ')}`);

// MCP_TOOL=fetch makes the second argument a note id instead of a search query.
const tool = process.env.MCP_TOOL === 'fetch' ? 'fetch' : 'search';
const t0 = Date.now();
const result = await client.callTool({ name: tool, arguments: tool === 'fetch' ? { id: query } : { q: query } });
console.log(`${tool} finished in ${Date.now() - t0} ms, isError=${Boolean(result.isError)}`);
const text = (result.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
console.log(text.split('\n').slice(0, 12).join('\n'));
console.log(`... (${text.length} chars total)`);
await client.close();
