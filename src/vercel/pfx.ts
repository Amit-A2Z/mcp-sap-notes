import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type Env = Record<string, string | undefined>;

/**
 * Serverless functions have no file for the certificate, so it arrives as a base64 string in
 * an environment variable. Decode it to a file with mode 600 and return the path.
 * Returns undefined when PFX_BASE64 is not set.
 */
export function materializePfx(env: Env, dir: string): string | undefined {
  const encoded = env.PFX_BASE64?.trim();
  if (!encoded) return undefined;

  const bytes = Buffer.from(encoded, 'base64');
  // A PKCS#12 file is an ASN.1 SEQUENCE, so the first byte is 0x30.
  if (bytes.length < 16 || bytes[0] !== 0x30) {
    throw new Error('PFX_BASE64 does not look like a PKCS#12 file (expected an ASN.1 SEQUENCE)');
  }

  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const path = join(dir, 'passport.pfx');
  if (existsSync(path) && readFileSync(path).equals(bytes)) return path;

  writeFileSync(path, bytes, { mode: 0o600 });
  chmodSync(path, 0o600);
  return path;
}
