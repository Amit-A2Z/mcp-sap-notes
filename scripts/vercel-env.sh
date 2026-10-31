#!/bin/bash
# Runs a command with the environment the Vercel deployment would have. Values come from the
# macOS Keychain and the certificate file at launch. Nothing is written to disk or printed.
#
#   scripts/vercel-env.sh vercel dev --listen 3000
#
# Same variables as on Vercel: PFX_BASE64, PFX_PASSPHRASE, SESSION_ENC_KEY, ACCESS_TOKEN, CRON_SECRET.
# The session cache goes to a local folder instead of /tmp (mode 700).
set -euo pipefail
umask 077

DIR="${SAP_DEBUG_DIR:-$HOME/.sap-mcp/vercel-debug}"
PFX_FILE="${PFX_PATH:-$DIR/passport.pfx}"

keychain() {
  security find-generic-password -s "$1" -w 2>/dev/null || { echo "vercel-env: Keychain item $1 is missing" >&2; exit 1; }
}

[ -r "$PFX_FILE" ] || { echo "vercel-env: certificate not found at $PFX_FILE" >&2; exit 1; }

mkdir -p "$DIR/function-cache"
chmod 700 "$DIR" "$DIR/function-cache"

PFX_BASE64="$(base64 < "$PFX_FILE" | tr -d '\n')"
PFX_PASSPHRASE="$(keychain "${SAP_PFX_KEYCHAIN_SERVICE:-sap-passport-pfx}")"
SESSION_ENC_KEY="$(keychain jam-sap-session-key)"
ACCESS_TOKEN="$(keychain jam-sap-access-token)"
CRON_SECRET="$(keychain jam-sap-cron-secret)"

export AUTH_METHOD=certificate
export PFX_BASE64 PFX_PASSPHRASE SESSION_ENC_KEY ACCESS_TOKEN CRON_SECRET
export SAP_WORK_DIR="$DIR/function-cache"

exec "$@"
