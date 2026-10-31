import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { get, put } from '@vercel/blob';
import { chromium } from 'playwright';
import { installLauncher } from './browser.js';
import { resolveSparticuz } from './chromium.js';
import { materializePfx } from './pfx.js';
import type { SessionPaths } from './session-files.js';
import { createSessionStore, type BlobClient, type SessionStore } from './session-store.js';

type Env = NodeJS.ProcessEnv;

export const onVercel = (env: Env = process.env): boolean => Boolean(env.VERCEL);

/**
 * Prepares the environment the existing server code expects:
 *   - PFX_BASE64 becomes a file and PFX_PATH points at it.
 *   - The two session cache files live in a writable folder (/tmp on Vercel).
 * Returns where the session files are, for the shared-session sync.
 */
export function prepareEnvironment(env: Env = process.env): { paths: SessionPaths; workDir: string } {
  const workDir = env.SAP_WORK_DIR ?? join(tmpdir(), 'sap-notes');

  const pfxPath = materializePfx(env, workDir);
  if (pfxPath) {
    env.PFX_PATH = pfxPath;
    env.AUTH_METHOD ??= 'certificate';
  }

  const paths: SessionPaths = {
    tokenCache: env.SAP_NOTES_TOKEN_CACHE_FILE ?? join(workDir, 'token-cache.json'),
    ssoState: env.SAP_SSO_STORAGE_STATE ?? join(workDir, 'sso-storage-state.json'),
  };
  env.SAP_NOTES_TOKEN_CACHE_FILE = paths.tokenCache;
  env.SAP_SSO_STORAGE_STATE = paths.ssoState;

  return { paths, workDir };
}

/** On Vercel, launch the browser from @sparticuz/chromium. Elsewhere Playwright's own browser is used. */
export function installBrowser(env: Env = process.env): void {
  if (!onVercel(env)) return;
  installLauncher(chromium, () => resolveSparticuz(env));
}

/** The shared session store, or null when the key or the Blob store is not configured. */
export function buildSessionStore(env: Env = process.env, log?: (message: string) => void): SessionStore | null {
  const key = env.SESSION_ENC_KEY;
  const hasBlob = Boolean(env.BLOB_READ_WRITE_TOKEN || env.BLOB_STORE_ID);
  if (!key || !hasBlob) return null;
  return createSessionStore({ client: { put, get } as unknown as BlobClient, key, log });
}
