import test from 'node:test';
import assert from 'node:assert/strict';
import { isAuthorizedBearer, isDiagnosticAllowed, isMcpAccessConfigured } from '../../src/vercel/bearer.ts';

const A = 'a'.repeat(32);
const B = 'b'.repeat(32);

test('accepts a matching bearer token', () => {
  assert.equal(isAuthorizedBearer(`Bearer ${A}`, [A]), true);
});

test('accepts any of several configured values', () => {
  assert.equal(isAuthorizedBearer(`Bearer ${B}`, [A, B]), true);
});

test('rejects a wrong token', () => {
  assert.equal(isAuthorizedBearer(`Bearer ${B}`, [A]), false);
});

test('rejects a token of a different length without throwing', () => {
  assert.equal(isAuthorizedBearer('Bearer short', [A]), false);
});

test('rejects a missing or malformed header', () => {
  assert.equal(isAuthorizedBearer(undefined, [A]), false);
  assert.equal(isAuthorizedBearer('', [A]), false);
  assert.equal(isAuthorizedBearer(A, [A]), false);
  assert.equal(isAuthorizedBearer(`Basic ${A}`, [A]), false);
});

test('rejects everything when no secret is configured', () => {
  assert.equal(isAuthorizedBearer('Bearer ', []), false);
  assert.equal(isAuthorizedBearer(`Bearer ${A}`, [undefined, '']), false);
});

test('diagnostics are closed by default', () => {
  assert.equal(isDiagnosticAllowed(undefined, [A], {}), false);
  assert.equal(isDiagnosticAllowed(undefined, [], {}), false);
});

test('diagnostics open only with the explicit flag set to 1', () => {
  assert.equal(isDiagnosticAllowed(undefined, [], { OPEN_DIAGNOSTICS: '1' }), true);
  assert.equal(isDiagnosticAllowed(undefined, [], { OPEN_DIAGNOSTICS: 'true' }), false);
  assert.equal(isDiagnosticAllowed(undefined, [], { OPEN_DIAGNOSTICS: '0' }), false);
});

test('a valid bearer token always works', () => {
  assert.equal(isDiagnosticAllowed(`Bearer ${A}`, [A], {}), true);
});

test('on Vercel the MCP endpoint needs ACCESS_TOKEN to be configured', () => {
  assert.equal(isMcpAccessConfigured({ VERCEL: '1' }), false);
  assert.equal(isMcpAccessConfigured({ VERCEL: '1', ACCESS_TOKEN: '   ' }), false);
  assert.equal(isMcpAccessConfigured({ VERCEL: '1', ACCESS_TOKEN: A }), true);
});

test('off Vercel the local default stays as it was', () => {
  assert.equal(isMcpAccessConfigured({}), true);
});
