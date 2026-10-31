import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptJson, decryptJson } from '../../src/vercel/session-crypto.ts';

const KEY = 'a'.repeat(48);

test('round trip returns the same object', () => {
  const data = { cookies: [{ name: 'a', value: 'b' }], n: 1 };
  assert.deepEqual(decryptJson(encryptJson(data, KEY), KEY), data);
});

test('payload is not readable and differs on every call', () => {
  const a = encryptJson({ marker: 'plain-marker-text' }, KEY);
  const b = encryptJson({ marker: 'plain-marker-text' }, KEY);
  assert.notEqual(a, b);
  assert.ok(!a.includes('plain-marker-text'));
  assert.ok(a.startsWith('v1.'));
});

test('wrong key fails', () => {
  const p = encryptJson({ x: 1 }, KEY);
  assert.throws(() => decryptJson(p, 'b'.repeat(48)));
});

test('tampered payload fails', () => {
  const p = encryptJson({ x: 1 }, KEY);
  const parts = p.split('.');
  const ct = Buffer.from(parts[3], 'base64');
  ct[0] ^= 1;
  parts[3] = ct.toString('base64');
  assert.throws(() => decryptJson(parts.join('.'), KEY));
});

test('short key is refused', () => {
  assert.throws(() => encryptJson({ x: 1 }, 'short'), /at least 32/);
});

test('unknown format is refused', () => {
  assert.throws(() => decryptJson('v9.a.b.c', KEY), /format/);
});
