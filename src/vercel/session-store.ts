import { decryptJson, encryptJson } from './session-crypto.js';
import type { SessionSnapshot } from './session-files.js';

// Shares the SAP login between function instances. The snapshot is encrypted before it
// leaves the function, so the stored object is useless without the key.
// A missing, unreadable or unreachable object means "no shared session": the caller then
// logs in normally. The store can fail without breaking a request.

export interface BlobClient {
  put(pathname: string, body: string, options: Record<string, unknown>): Promise<unknown>;
  get(pathname: string, options: Record<string, unknown>): Promise<{ stream: ReadableStream<Uint8Array> } | null>;
}

export interface SessionStoreOptions {
  client: BlobClient;
  key: string;
  pathname?: string;
  log?: (message: string) => void;
}

export interface SessionStore {
  save(snapshot: SessionSnapshot): Promise<void>;
  load(): Promise<SessionSnapshot | null>;
}

export const DEFAULT_PATHNAME = 'sap-notes/session.enc';

export function createSessionStore(options: SessionStoreOptions): SessionStore {
  const { client, key } = options;
  const pathname = options.pathname ?? DEFAULT_PATHNAME;
  const log = options.log ?? (() => {});

  return {
    async save(snapshot) {
      await client.put(pathname, encryptJson(snapshot, key), {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'text/plain',
        // Short cache so a new login reaches other instances quickly.
        cacheControlMaxAge: 60,
      });
    },

    async load() {
      try {
        // useCache false reads from origin, so a fresh login is seen at once.
        const result = await client.get(pathname, { access: 'private', useCache: false });
        if (!result) return null;
        const text = await new Response(result.stream).text();
        return decryptJson<SessionSnapshot>(text, key);
      } catch (error) {
        log(`Shared session not used: ${error instanceof Error ? error.message : String(error)}`);
        return null;
      }
    },
  };
}
