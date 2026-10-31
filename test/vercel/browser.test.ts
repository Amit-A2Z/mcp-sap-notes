import test from 'node:test';
import assert from 'node:assert/strict';
import { installLauncher } from '../../src/vercel/browser.ts';

function fakeChromium() {
  const calls: any[] = [];
  return { calls, launch: async (opts: any) => { calls.push(opts); return { ok: true }; } };
}

test('adds executablePath and merges args, caller options win for headless', async () => {
  const c = fakeChromium();
  installLauncher(c as any, async () => ({ executablePath: '/tmp/chromium', args: ['--a', '--b'] }));
  await c.launch({ headless: false, args: ['--c'] });
  assert.equal(c.calls[0].executablePath, '/tmp/chromium');
  assert.deepEqual(c.calls[0].args, ['--a', '--b', '--c']);
  assert.equal(c.calls[0].headless, false);
});

test('does not wrap twice', async () => {
  const c = fakeChromium();
  const resolver = async () => ({ executablePath: '/x', args: ['--once'] });
  installLauncher(c as any, resolver);
  installLauncher(c as any, resolver);
  await c.launch({});
  assert.deepEqual(c.calls[0].args, ['--once']);
});

test('resolves the binary once and reuses it', async () => {
  const c = fakeChromium();
  let n = 0;
  installLauncher(c as any, async () => { n += 1; return { executablePath: '/x', args: [] }; });
  await c.launch({}); await c.launch({});
  assert.equal(n, 1);
});
