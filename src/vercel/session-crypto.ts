import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

// Encrypts a small JSON value with AES-256-GCM. Used for the SAP session blob that is
// stored outside the function, so that the stored object is useless without the key.
// Format: v1.<iv>.<tag>.<ciphertext>, each part base64.

const VERSION = 'v1';
const AAD = Buffer.from('sap-notes-session-v1');

function keyFrom(secret: string): Buffer {
  if (!secret || secret.length < 32) {
    throw new Error('Session key must be at least 32 characters');
  }
  return createHash('sha256').update(secret, 'utf8').digest();
}

export function encryptJson(value: unknown, secret: string): string {
  const key = keyFrom(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join('.');
}

export function decryptJson<T = unknown>(payload: string, secret: string): T {
  const parts = payload.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Unknown session payload format');
  }
  const key = keyFrom(secret);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(parts[1], 'base64'));
  decipher.setAAD(AAD);
  decipher.setAuthTag(Buffer.from(parts[2], 'base64'));
  const plain = Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64')), decipher.final()]);
  return JSON.parse(plain.toString('utf8')) as T;
}
