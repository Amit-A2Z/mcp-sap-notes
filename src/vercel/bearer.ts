import { createHash, timingSafeEqual } from 'node:crypto';

// Checks an `Authorization: Bearer <token>` header against the configured values.
// Both sides are hashed first, so the comparison always runs on equal-length buffers
// and does not leak where a wrong token first differs.
// With no configured value, nothing is accepted.

const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest();

/**
 * The upstream server lets every request through when ACCESS_TOKEN is empty. That is fine on a
 * laptop. On Vercel the endpoint must fail closed, so it refuses to serve until a token is set.
 */
export function isMcpAccessConfigured(env: Record<string, string | undefined>): boolean {
  if (!env.VERCEL) return true;
  return typeof env.ACCESS_TOKEN === 'string' && env.ACCESS_TOKEN.trim().length > 0;
}

/**
 * The browser diagnostic shows no secret, only a version and timings. It can be opened with the
 * plain setting OPEN_DIAGNOSTICS=1 for a first test before any secret is configured.
 * Without that setting a valid bearer token is required.
 */
export function isDiagnosticAllowed(
  header: string | undefined,
  accepted: Array<string | undefined>,
  env: Record<string, string | undefined>,
): boolean {
  return env.OPEN_DIAGNOSTICS === '1' || isAuthorizedBearer(header, accepted);
}

export function isAuthorizedBearer(header: string | undefined, accepted: Array<string | undefined>): boolean {
  const secrets = accepted.filter((value): value is string => typeof value === 'string' && value.length > 0);
  if (secrets.length === 0 || !header) return false;

  const match = /^Bearer (.+)$/.exec(header);
  if (!match) return false;

  const given = digest(match[1]);
  let ok = false;
  for (const secret of secrets) {
    if (timingSafeEqual(given, digest(secret))) ok = true;
  }
  return ok;
}
