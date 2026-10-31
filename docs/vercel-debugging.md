# Debugging on Vercel without a VM or SSH

This branch is a practice workspace. It shows how people debug a server that runs on Vercel,
where there is no machine to log in to. Nothing here deploys the SAP server itself.

The idea: find the bug on your own machine first, then use Vercel's logs and build output for
what only happens in the cloud.

## What was added

| Path | What it does |
|---|---|
| `scripts/debug-env.sh` | Starts a command with the SAP login environment. Reads the passphrase from the macOS Keychain at launch. |
| `scripts/mcp-stdio-client.mjs` | A tiny MCP client that starts the stdio server and calls one tool. |
| `scripts/mcp-http-client.mjs` | Calls the HTTP server, local or on Vercel. |
| `scripts/vercel-dev-debug.sh` | Runs `vercel dev` so the function waits for a debugger. |
| `.vscode/launch.json`, `.vscode/tasks.json` | The debug configurations. |
| `api/health.ts` | A small function that reports facts about where it runs. No secrets. |
| `vercel.json`, `public/`, `.vercelignore` | Vercel settings. See "Traps". |

## One-time setup

1. Put your certificate where the wrapper looks for it:
   `ln -s /path/to/your.pfx ~/.sap-mcp/vercel-debug/passport.pfx`
2. Store its passphrase in the Keychain as a generic password with service `sap-passport-pfx`.
3. `npm ci`, then `npx playwright install chromium`, then `npm run build`.

The wrapper writes the session cache to `~/.sap-mcp/vercel-debug/` (mode 700). Nothing secret goes
into the repo. `.gitignore` covers `.env*`, `.vercel`, `*.pfx` and the cache files.

## The debugging ladder

Start at the top. Move down only when the cheaper step cannot show the problem.

| Step | How | What you see |
|---|---|---|
| 1. Stdio server | Run and Debug, pick "stdio: client + server", press F5 | Breakpoints in `src/*.ts`. Try line 112 of `src/sap-notes-api.ts` (`searchNotes`). The first run does the real certificate login, about 25 s. |
| 2. HTTP server | Pick "HTTP server (src/http-mcp-server.ts, tsx)", then `node scripts/mcp-http-client.mjs` in a terminal | The same code reached over HTTP. |
| 3. Login only | Pick "test/test-auth.js (certificate login)" | The login step alone. It prints the start of the cookie header, so do not share that terminal. |
| 4. Function under `vercel dev` | Pick "vercel dev: function (breakpoints in api/health.ts)", then open `http://localhost:3000/api/health` | Breakpoints inside a Vercel function, running on your machine. |
| 5. Deployed | `vercel deploy`, `vercel inspect`, `vercel logs` | What the cloud did. See below. |

## Cloud commands

```bash
vercel deploy                         # preview deployment, protected
vercel inspect <url>                  # summary: target, status, build time
vercel inspect <url> --logs           # build log (why a build failed)
vercel logs --deployment <url> --since 30m     # runtime output (console.log)
vercel logs requests --deployment <url> --since 30m   # one record per request
vercel curl /api/health --deployment <url>     # request through the protection
vercel env pull .env.local            # copy the project's development variables down
vercel pull && vercel build           # build locally, output goes to .vercel/output
```

Runtime logs lag by 10 to 20 seconds. On the Hobby plan they are kept for 1 hour
(https://vercel.com/docs/logs/runtime).

## Privacy of a deployment

- Deployment Protection scope "All Deployments" (Vercel Authentication) is set on the project.
  Anyone without a Vercel login or the bypass secret gets a redirect to the Vercel login page.
- Scripts and tools get through with the header `x-vercel-protection-bypass: <secret>`.
  The secret belongs to the project. `vercel api /v9/projects/<name>` can read it back, so treat
  project access as secret access.
- Do not put the secret on a command line you share, and keep it out of the repo.

## What we measured (2026-10-31)

| Question | Local `vercel dev` | Deployed preview |
|---|---|---|
| New process per request? | Yes. `invocations` was always 1. | No. The same instance served 7 requests in a row. |
| Node version | 24 (your PATH) | 26 (project default, `nodeVersion` setting) |
| CPU and memory | Your machine | 2 vCPU, about 2.2 GB (Hobby limit) |
| Region | `dev1` | `iad1` (Washington), the edge answered from the nearest city |
| Code the runtime runs | TypeScript, minified to one line with a source map | the same |
| Build architecture | `vercel build` wrote `arm64` | the deployed instance reported `x64` |

Why it matters: a module-level counter or cache behaves differently in the two places. Test
caching and cold-start ideas in the cloud, not only locally. The arm64 versus x64 difference will
matter for any binary we ship, such as a browser.

## Traps we hit

1. **The first deployment of a project is always Production**, even with `--target=preview`.
   We made it a failing empty one on purpose, so nothing was served and every later deploy is a
   true Preview. The failure is also a good first use of `vercel inspect --logs`.
2. **New projects start with scope `all_except_custom_domains`.** We changed it to `all` before
   any deployment: `PATCH /v9/projects/<name>` with `{"ssoProtection":{"deploymentType":"all"}}`.
3. **`vercel dev` stalled with `yarn: command not found`.** It tried the default build step.
   `"buildCommand": ""` and `"outputDirectory": "public"` in `vercel.json` fix it.
4. **Without a `public/` folder Vercel serves the repo root as static files.** Keep a `public/`.
5. **`.vercelignore` replaces `.gitignore` for uploads.** It lists the secret patterns again.
6. **`NODE_OPTIONS=--inspect-brk` debugs the wrong process.** The Vercel CLI is itself a Node
   program and takes port 9229 first, so the function fails with "address already in use".
   `scripts/vercel-dev-debug.sh` puts a `node` shim first in `PATH` so only the function gets the flag.
7. **Environment variables are fixed at build time.** The bypass secret appeared as a variable
   only in deployments built after it existed.
8. **Logs are not instant.** Wait 20 seconds before deciding a log line is missing.

## Not covered here

- Running the real SAP server on Vercel. It needs a browser that fits in a function, a shared
  session store and the certificate as a secret. That is a later phase and needs a decision first.
- The VS Code attach for `vercel dev` uses the standard re-attach pattern. The function pause on
  port 9229 and a breakpoint inside `api/health.ts` were verified with a raw inspector client.
  Check the editor flow yourself the first time.
