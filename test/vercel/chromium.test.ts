import test from 'node:test';
import assert from 'node:assert/strict';
import { selectChromiumArgs } from '../../src/vercel/chromium.ts';

const args = ['--no-sandbox', '--single-process', '--no-zygote', '--font-render-hinting=none'];

test('drops --single-process by default', () => {
  assert.deepEqual(selectChromiumArgs(args), ['--no-sandbox', '--no-zygote', '--font-render-hinting=none']);
});

test('keeps it when asked', () => {
  assert.deepEqual(selectChromiumArgs(args, { keepSingleProcess: true }), args);
});

test('does not change the input array', () => {
  const copy = [...args];
  selectChromiumArgs(args);
  assert.deepEqual(args, copy);
});

test('leaves other flags that merely start the same way', () => {
  assert.deepEqual(selectChromiumArgs(['--single-process-extra']), ['--single-process-extra']);
});
