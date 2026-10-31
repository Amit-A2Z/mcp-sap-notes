#!/bin/bash
# Uploads the five secrets to the linked Vercel project as Sensitive (write-only) variables.
# Values flow from the certificate file and the Keychain into `vercel env add` on stdin.
# Nothing is printed and nothing is written to disk. Run it again to rotate (it overwrites).
#
#   scripts/keychain-init.sh        once, creates the three random values
#   scripts/vercel-env-upload.sh    uploads them with the certificate
#
# Only run this after deciding that the certificate may be stored at Vercel.
set -euo pipefail
cd "$(dirname "$0")/.."

DIR="${SAP_DEBUG_DIR:-$HOME/.sap-mcp/vercel-debug}"
PFX_FILE="${PFX_PATH:-$DIR/passport.pfx}"
ENVIRONMENTS="${UPLOAD_ENVIRONMENTS:-production,preview}"

[ -r "$PFX_FILE" ] || { echo "upload: certificate not found at $PFX_FILE" >&2; exit 1; }

keychain() {
  security find-generic-password -s "$1" -w 2>/dev/null | tr -d '\n' || { echo "upload: Keychain item $1 is missing" >&2; exit 1; }
}

add() {
  # The value arrives on stdin. --force overwrites an existing variable.
  vercel env add "$1" -e "$ENVIRONMENTS" --sensitive --force >/dev/null 2>&1 \
    && echo "uploaded: $1 ($ENVIRONMENTS, sensitive)" \
    || { echo "upload FAILED: $1" >&2; exit 1; }
}

base64 < "$PFX_FILE" | tr -d '\n' | add PFX_BASE64
keychain "${SAP_PFX_KEYCHAIN_SERVICE:-sap-passport-pfx}" | add PFX_PASSPHRASE
keychain jam-sap-session-key | add SESSION_ENC_KEY
keychain jam-sap-access-token | add ACCESS_TOKEN
keychain jam-sap-cron-secret | add CRON_SECRET
