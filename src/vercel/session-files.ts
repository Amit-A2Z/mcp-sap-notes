import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

// The auth library keeps the SAP session in two files. They are treated as opaque text here.
// A snapshot of both is what gets encrypted and shared between function instances.

export interface SessionPaths {
  tokenCache: string;
  ssoState: string;
}

export interface SessionSnapshot {
  tokenCache: string | null;
  ssoState: string | null;
  savedAt: number;
}

function readIfExists(path: string): string | null {
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

function writeSecret(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, content, { mode: 0o600 });
  chmodSync(path, 0o600);
}

export function captureSession(paths: SessionPaths): SessionSnapshot | null {
  const tokenCache = readIfExists(paths.tokenCache);
  const ssoState = readIfExists(paths.ssoState);
  if (tokenCache === null && ssoState === null) return null;
  return { tokenCache, ssoState, savedAt: Date.now() };
}

export function restoreSession(snapshot: SessionSnapshot, paths: SessionPaths): void {
  if (snapshot.tokenCache !== null) writeSecret(paths.tokenCache, snapshot.tokenCache);
  if (snapshot.ssoState !== null) writeSecret(paths.ssoState, snapshot.ssoState);
}

/** Hash of both files, used to notice that a login changed them. Never printed. */
export function sessionSignature(paths: SessionPaths): string {
  const a = readIfExists(paths.tokenCache);
  const b = readIfExists(paths.ssoState);
  if (a === null && b === null) return 'empty';
  return createHash('sha256').update(a ?? '').update('\u0000').update(b ?? '').digest('hex');
}
