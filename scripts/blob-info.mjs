#!/usr/bin/env node
// Shows what is in the shared-session store: name, size and age. Never the content.
//
//   node --env-file=.env.local scripts/blob-info.mjs
//
// `vercel env pull` writes .env.local. It holds the Blob access for the development environment.
import { del, head, list } from '@vercel/blob';

// `--delete` removes the stored session, so the next request must log in again. Use it to test a cold login.
const DELETE = process.argv.includes('--delete');

// Locally the pulled file has an OIDC token but no BLOB_STORE_ID. The SDK then cannot choose
// between OIDC and the read-write token. Use the read-write token.
if (process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) {
  delete process.env.VERCEL_OIDC_TOKEN;
}

const PATHNAME = process.env.SESSION_BLOB_PATH ?? 'sap-notes/session.enc';

if (DELETE) {
  await del(PATHNAME);
  console.log(`deleted ${PATHNAME}`);
}

const { blobs } = await list({ prefix: 'sap-notes/' });
if (blobs.length === 0) {
  console.log('store is empty');
} else {
  for (const blob of blobs) {
    const ageMin = Math.round((Date.now() - new Date(blob.uploadedAt).getTime()) / 60000);
    console.log(`${blob.pathname}  ${blob.size} bytes  uploaded ${blob.uploadedAt}  (${ageMin} min ago)`);
  }
}

try {
  const info = await head(PATHNAME);
  console.log(`head ok: etag ${info.etag}, ${info.size} bytes, type ${info.contentType}`);
} catch (error) {
  console.log(`head failed: ${error instanceof Error ? error.message : String(error)}`);
}
