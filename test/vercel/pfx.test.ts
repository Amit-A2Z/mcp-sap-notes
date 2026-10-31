import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, statSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { materializePfx } from '../../src/vercel/pfx.ts';

// A fake blob that starts with an ASN.1 SEQUENCE byte, like a real PKCS#12 file.
const fake = Buffer.concat([Buffer.from([0x30, 0x82, 0x01, 0x00]), Buffer.alloc(300, 7)]);

test('decodes PFX_BASE64 to a file with mode 600', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pfx-'));
  const path = materializePfx({ PFX_BASE64: fake.toString('base64') }, dir);
  assert.ok(path);
  assert.equal(statSync(path!).mode & 0o777, 0o600);
  assert.deepEqual(readFileSync(path!), fake);
});

test('returns undefined when PFX_BASE64 is absent', () => {
  assert.equal(materializePfx({}, mkdtempSync(join(tmpdir(), 'pfx-'))), undefined);
});

test('rejects content that is not ASN.1', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pfx-'));
  assert.throws(() => materializePfx({ PFX_BASE64: Buffer.from('not a pfx at all').toString('base64') }, dir), /PKCS#12/);
});

test('is idempotent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pfx-'));
  const env = { PFX_BASE64: fake.toString('base64') };
  assert.equal(materializePfx(env, dir), materializePfx(env, dir));
});
