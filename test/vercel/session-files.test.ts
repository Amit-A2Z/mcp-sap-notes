import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { captureSession, restoreSession, sessionSignature } from '../../src/vercel/session-files.ts';

function paths() {
  const dir = mkdtempSync(join(tmpdir(), 'sess-'));
  return { tokenCache: join(dir, 'token-cache.json'), ssoState: join(dir, 'sso.json') };
}

test('capture returns null when no file exists', () => {
  assert.equal(captureSession(paths()), null);
});

test('capture then restore reproduces both files with mode 600', () => {
  const a = paths();
  writeFileSync(a.tokenCache, '{"cookieHeader":"x"}');
  writeFileSync(a.ssoState, '{"cookies":[]}');
  const snap = captureSession(a)!;
  const b = paths();
  restoreSession(snap, b);
  assert.equal(readFileSync(b.tokenCache, 'utf8'), '{"cookieHeader":"x"}');
  assert.equal(readFileSync(b.ssoState, 'utf8'), '{"cookies":[]}');
  assert.equal(statSync(b.tokenCache).mode & 0o777, 0o600);
  assert.equal(statSync(b.ssoState).mode & 0o777, 0o600);
});

test('restore skips a file that was not captured', () => {
  const a = paths();
  writeFileSync(a.tokenCache, '{"k":1}');
  const snap = captureSession(a)!;
  const b = paths();
  restoreSession(snap, b);
  assert.ok(existsSync(b.tokenCache));
  assert.ok(!existsSync(b.ssoState));
});

test('signature changes when content changes and is stable otherwise', () => {
  const a = paths();
  writeFileSync(a.tokenCache, 'one');
  const s1 = sessionSignature(a);
  assert.equal(sessionSignature(a), s1);
  writeFileSync(a.tokenCache, 'two');
  assert.notEqual(sessionSignature(a), s1);
});

test('signature of missing files is a fixed empty marker', () => {
  assert.equal(sessionSignature(paths()), 'empty');
});
