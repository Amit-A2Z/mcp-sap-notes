#!/bin/bash
# Creates the random values the server needs, once, in the macOS Keychain.
# A value is only created when its item is missing. Nothing is printed.
#
#   jam-sap-session-key   encrypts the shared SAP session before it is stored
#   jam-sap-access-token  bearer token for the MCP endpoint
#   jam-sap-cron-secret   what Vercel's cron sends to /refresh
#
# The values go to `security` on stdin, so they never show up in a process list.
set -euo pipefail

for service in jam-sap-session-key jam-sap-access-token jam-sap-cron-secret; do
  if security find-generic-password -s "$service" >/dev/null 2>&1; then
    echo "exists:  $service"
    continue
  fi
  value="$(openssl rand -hex 24)"
  printf 'add-generic-password -s %s -a jam-sap-notes -w %s -U\n' "$service" "$value" | security -i >/dev/null
  unset value
  echo "created: $service"
done
