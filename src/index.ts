// Entry point for Vercel. Vercel serves the default-exported Express app as one function.
// Locally, `npm run serve:http` still starts the same server through src/http-mcp-server.ts.
import express, { type NextFunction, type Request, type Response } from 'express';
import { waitUntil } from '@vercel/functions';
import { chromium } from 'playwright';
import { HttpSapNoteMcpServer } from './http-mcp-server.js';
import { logger } from './logger.js';
import { isAuthorizedBearer, isDiagnosticAllowed, isMcpAccessConfigured } from './vercel/bearer.js';
import { buildSessionStore, installBrowser, prepareEnvironment } from './vercel/runtime.js';
import { createSessionSync } from './vercel/session-sync.js';

const describe = (error: unknown): string => (error instanceof Error ? error.message : String(error));

// Order matters: environment first, then the browser swap, then the server that reads both.
const { paths } = prepareEnvironment();
installBrowser();
const sync = createSessionSync(paths, buildSessionStore(process.env, (message) => logger.warn(message)));

let server: HttpSapNoteMcpServer | undefined;
let startupError: string | undefined;
try {
  server = new HttpSapNoteMcpServer();
} catch (error) {
  startupError = describe(error);
  logger.error(`Server not configured: ${startupError}`);
}

/** Work that should finish after the response is sent. */
function later(task: Promise<unknown>): void {
  const safe = task.catch((error) => logger.error(`Background task failed: ${describe(error)}`));
  try {
    waitUntil(safe);
  } catch {
    void safe; // not running on Vercel
  }
}

/** Share a new login only after a real search proved that it works. */
async function shareVerifiedSession(): Promise<void> {
  if (!server || !sync.hasUnsavedChanges()) return;
  await server.verifySession();
  await sync.persistIfChanged();
}

// CRON_SECRET is what Vercel's cron sends. ACCESS_TOKEN lets the owner call the same routes by hand.
function requireOperator(req: Request, res: Response, next: NextFunction): void {
  if (isAuthorizedBearer(req.headers.authorization, [process.env.CRON_SECRET, process.env.ACCESS_TOKEN])) {
    next();
    return;
  }
  res.status(401).json({ ok: false, error: 'unauthorized' });
}

const app = express();

// Diagnostic: can this function start a browser? Needs no SAP login and shows nothing secret.
function requireDiagnosticAccess(req: Request, res: Response, next: NextFunction): void {
  if (isDiagnosticAllowed(req.headers.authorization, [process.env.CRON_SECRET, process.env.ACCESS_TOKEN], process.env)) {
    next();
    return;
  }
  res.status(401).json({ ok: false, error: 'unauthorized' });
}

app.get('/chromium-check', requireDiagnosticAccess, async (_req: Request, res: Response) => {
  const started = Date.now();
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const launched = Date.now() - started;
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setContent('<title>ok</title><p>browser works</p>');
    res.json({
      ok: true,
      title: await page.title(),
      browserVersion: browser.version(),
      launchMs: launched,
      totalMs: Date.now() - started,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: describe(error), totalMs: Date.now() - started });
  } finally {
    await browser?.close().catch(() => undefined);
  }
});

app.use((_req: Request, res: Response, next: NextFunction) => {
  if (server) {
    next();
    return;
  }
  res.status(503).json({ ok: false, error: 'server not configured', detail: startupError });
});

// Fail closed: on Vercel the MCP endpoint is not served until ACCESS_TOKEN is set.
app.use('/mcp', (_req: Request, res: Response, next: NextFunction) => {
  if (isMcpAccessConfigured(process.env)) {
    next();
    return;
  }
  res.status(503).json({ ok: false, error: 'ACCESS_TOKEN is not configured' });
});

// Scheduled refresh: log in ahead of time and share the session. Safe to call by hand.
app.get('/refresh', requireOperator, async (_req: Request, res: Response) => {
  const started = Date.now();
  try {
    await sync.hydrate();
    await server!.verifySession();
    const shared = await sync.persistIfChanged();
    res.json({ ok: true, sharedSessionUpdated: shared, totalMs: Date.now() - started });
  } catch (error) {
    logger.error(`Refresh failed: ${describe(error)}`);
    res.status(502).json({ ok: false, error: describe(error), totalMs: Date.now() - started });
  }
});

// Every other request: reuse the shared session on a cold instance, and share a new one after a login.
app.use(async (_req: Request, res: Response, next: NextFunction) => {
  await sync.hydrate().catch((error) => logger.warn(`Hydrate failed: ${describe(error)}`));
  res.on('finish', () => later(shareVerifiedSession()));
  next();
});

app.use(server ? server.expressApp : (_req: Request, _res: Response, next: NextFunction) => next());

// Four arguments, so Express treats it as the error handler and Vercel does not recycle the instance.
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(`Unhandled error: ${describe(error)}`);
  if (!res.headersSent) res.status(500).json({ ok: false, error: 'internal error' });
});

export default app;
