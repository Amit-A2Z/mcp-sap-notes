import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSessionSync } from '../../src/vercel/session-sync.ts';
import type { SessionStore } from '../../src/vercel/session-store.ts';
import type { SessionSnapshot } from '../../src/vercel/session-files.ts';

function setup(initial: SessionSnapshot | null = null) {
  const dir = mkdtempSync(join(tmpdir(), 'sync-'));
  const paths = { tokenCache: join(dir, 'a.json'), ssoState: join(dir, 'b.json') };
  const saved: SessionSnapshot[] = [];
  let stored = initial;
  const store: SessionStore = {
    async save(s) { saved.push(s); stored = s; },
    async load() { return stored; },
  };
  return { paths, store, saved };
}

const remote: SessionSnapshot = {
  tokenCache: JSON.stringify({ from: 'remote' }),
  ssoState: JSON.stringify({ cookies: [] }),
  savedAt: 5,
};

test('hydrate restores the shared session when no local session exists', async () => {
  const { paths, store } = setup(remote);
  const sync = createSessionSync(paths, store);
  await sync.hydrate();
  assert.equal(readFileSync(paths.tokenCache, 'utf8'), remote.tokenCache);
});

test('hydrate does nothing when the store is empty', async () => {
  const { paths, store } = setup(null);
  await createSessionSync(paths, store).hydrate();
  assert.ok(!existsSync(paths.tokenCache));
});

test('hydrate keeps an existing local session and does not ask the store', async () => {
  const { paths } = setup(remote);
  writeFileSync(paths.tokenCache, 'local');
  let asked = 0;
  const store: SessionStore = { save: async () => {}, load: async () => { asked += 1; return remote; } };
  await createSessionSync(paths, store).hydrate();
  assert.equal(asked, 0);
  assert.equal(readFileSync(paths.tokenCache, 'utf8'), 'local');
});

test('hydrate runs once even when called twice at the same time', async () => {
  const { paths } = setup(remote);
  let asked = 0;
  const store: SessionStore = { save: async () => {}, load: async () => { asked += 1; return remote; } };
  const sync = createSessionSync(paths, store);
  await Promise.all([sync.hydrate(), sync.hydrate()]);
  assert.equal(asked, 1);
});

test('persistIfChanged saves only after the files changed', async () => {
  const { paths, store, saved } = setup(remote);
  const sync = createSessionSync(paths, store);
  await sync.hydrate();
  assert.equal(await sync.persistIfChanged(), false);
  assert.equal(saved.length, 0);
  writeFileSync(paths.tokenCache, JSON.stringify({ from: 'new login' }));
  assert.equal(await sync.persistIfChanged(), true);
  assert.equal(saved.length, 1);
  assert.equal(await sync.persistIfChanged(), false);
});

test('persistIfChanged does nothing when there is no session at all', async () => {
  const { paths, store, saved } = setup(null);
  const sync = createSessionSync(paths, store);
  await sync.hydrate();
  assert.equal(await sync.persistIfChanged(), false);
  assert.equal(saved.length, 0);
});

test('without a store everything is a no-op', async () => {
  const { paths } = setup(null);
  const sync = createSessionSync(paths, null);
  await sync.hydrate();
  writeFileSync(paths.tokenCache, 'x');
  assert.equal(await sync.persistIfChanged(), false);
});

test('hasUnsavedChanges is true only while a changed session is waiting to be shared', async () => {
  const { paths, store } = setup(remote);
  const sync = createSessionSync(paths, store);
  await sync.hydrate();
  assert.equal(sync.hasUnsavedChanges(), false);
  writeFileSync(paths.tokenCache, JSON.stringify({ from: 'new login' }));
  assert.equal(sync.hasUnsavedChanges(), true);
  await sync.persistIfChanged();
  assert.equal(sync.hasUnsavedChanges(), false);
});

test('hasUnsavedChanges is false without a store or without a session', async () => {
  const none = setup(null);
  assert.equal(createSessionSync(none.paths, none.store).hasUnsavedChanges(), false);
  const noStore = setup(null);
  const sync = createSessionSync(noStore.paths, null);
  writeFileSync(noStore.paths.tokenCache, 'x');
  assert.equal(sync.hasUnsavedChanges(), false);
});
