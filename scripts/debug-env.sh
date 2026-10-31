#!/bin/bash
# Run a command with the SAP login environment for local debugging.
#
#   scripts/debug-env.sh node --import tsx src/mcp-server.ts
#
# Secrets are read at launch and live only in the environment of the child process.
# Nothing is written to the repo.
#   - Passphrase: macOS Keychain, generic password, service "sap-passport-pfx"
#   - Certificate: $SAP_DEBUG_DIR/passport.pfx (a file or a symlink you create once)
#   - Session cache: $SAP_DEBUG_DIR (default ~/.sap-mcp/vercel-debug, mode 700)
set -euo pipefail
umask 077

DIR="${SAP_DEBUG_DIR:-$HOME/.sap-mcp/vercel-debug}"
SERVICE="${SAP_PFX_KEYCHAIN_SERVICE:-sap-passport-pfx}"
PFX_PATH="${PFX_PATH:-$DIR/passport.pfx}"

mkdir -p "$DIR"
chmod 700 "$DIR"

if [ ! -r "$PFX_PATH" ]; then
  echo "debug-env: certificate not found at $PFX_PATH" >&2
  echo "debug-env: link it once: ln -s <your .pfx> \"$DIR/passport.pfx\"" >&2
  exit 1
fi

if ! PFX_PASSPHRASE="$(security find-generic-password -s "$SERVICE" -w 2>/dev/null)"; then
  echo "debug-env: no Keychain item with service \"$SERVICE\"" >&2
  exit 1
fi

# Short-lived bearer token for the local HTTP server. The server listens on all
# interfaces, so it must not run open. A new value is made on every launch.
ACCESS_TOKEN="$(openssl rand -hex 16)"
printf '%s' "$ACCESS_TOKEN" > "$DIR/http-access-token"

export AUTH_METHOD=certificate
export PFX_PATH PFX_PASSPHRASE ACCESS_TOKEN
export SAP_NOTES_TOKEN_CACHE_FILE="$DIR/token-cache.json"
export SAP_SSO_STORAGE_STATE="$DIR/sso-storage-state.json"

exec "$@"
