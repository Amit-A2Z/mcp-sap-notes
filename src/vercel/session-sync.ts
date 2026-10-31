import { captureSession, restoreSession, sessionSignature, type SessionPaths } from './session-files.js';
import type { SessionStore } from './session-store.js';

// One of these lives in each function instance.
//   hydrate()          once on a cold instance: copy the shared session into the local files,
//                      unless the instance already has one.
//   persistIfChanged() after a request: if a login changed the local files, share the new session.

export interface SessionSync {
  hydrate(): Promise<void>;
  /** True when a login changed the local session and it has not been shared yet. */
  hasUnsavedChanges(): boolean;
  persistIfChanged(): Promise<boolean>;
}

export function createSessionSync(paths: SessionPaths, store: SessionStore | null): SessionSync {
  let hydration: Promise<void> | undefined;
  let lastSignature = sessionSignature(paths);

  async function runHydration(): Promise<void> {
    if (!store) return;
    if (sessionSignature(paths) !== 'empty') {
      lastSignature = sessionSignature(paths);
      return;
    }
    const snapshot = await store.load();
    if (snapshot) restoreSession(snapshot, paths);
    lastSignature = sessionSignature(paths);
  }

  return {
    hydrate() {
      hydration ??= runHydration();
      return hydration;
    },

    hasUnsavedChanges() {
      if (!store) return false;
      const signature = sessionSignature(paths);
      return signature !== 'empty' && signature !== lastSignature;
    },

    async persistIfChanged() {
      if (!store) return false;
      const signature = sessionSignature(paths);
      if (signature === 'empty' || signature === lastSignature) return false;
      const snapshot = captureSession(paths);
      if (!snapshot) return false;
      await store.save(snapshot);
      lastSignature = signature;
      return true;
    },
  };
}
