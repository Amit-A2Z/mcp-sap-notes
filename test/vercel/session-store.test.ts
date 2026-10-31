import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionStore, type BlobClient } from '../../src/vercel/session-store.ts';

const KEY = 'k'.repeat(48);
const snap = {
  tokenCache: JSON.stringify({ marker: 'plain-marker-text' }),
  ssoState: JSON.stringify({ cookies: [] }),
  savedAt: 1700000000000,
};

function fakeClient() {
  const objects = new Map<string, { body: string; opts: any }>();
  const client: BlobClient = {
    async put(pathname, body, opts) { objects.set(pathname, { body, opts }); return {}; },
    async get(pathname) {
      const o = objects.get(pathname);
      return o ? { stream: new Response(o.body).body! } : null;
    },
  };
  return { client, objects };
}

test('save then load returns the same snapshot', async () => {
  const { client } = fakeClient();
  const store = createSessionStore({ client, key: KEY });
  await store.save(snap);
  assert.deepEqual(await store.load(), snap);
});

test('stored body is encrypted, private and overwrites one fixed path', async () => {
  const { client, objects } = fakeClient();
  const store = createSessionStore({ client, key: KEY, pathname: 'p/session.enc' });
  await store.save(snap);
  await store.save({ ...snap, savedAt: 2 });
  assert.equal(objects.size, 1);
  const o = objects.get('p/session.enc')!;
  assert.ok(!o.body.includes('plain-marker-text'));
  assert.equal(o.opts.access, 'private');
  assert.equal(o.opts.allowOverwrite, true);
  assert.equal(o.opts.addRandomSuffix, false);
});

test('load returns null when nothing is stored', async () => {
  const { client } = fakeClient();
  assert.equal(await createSessionStore({ client, key: KEY }).load(), null);
});

test('load returns null when the key is wrong', async () => {
  const { client } = fakeClient();
  await createSessionStore({ client, key: KEY }).save(snap);
  assert.equal(await createSessionStore({ client, key: 'z'.repeat(48) }).load(), null);
});

test('load returns null when the store is unreachable', async () => {
  const client: BlobClient = { put: async () => ({}), get: async () => { throw new Error('network down'); } };
  assert.equal(await createSessionStore({ client, key: KEY }).load(), null);
});

test('save passes errors up so the caller can log them', async () => {
  const client: BlobClient = { put: async () => { throw new Error('quota'); }, get: async () => null };
  await assert.rejects(createSessionStore({ client, key: KEY }).save(snap), /quota/);
});
