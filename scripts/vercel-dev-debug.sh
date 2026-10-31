#!/bin/bash
# Run `vercel dev` so that only the FUNCTION process waits for a debugger on port 9229.
#
# Why not NODE_OPTIONS=--inspect-brk? The Vercel CLI is itself a Node program and would
# claim port 9229 first, so the function fails with "address already in use".
# Instead a tiny `node` shim goes first in PATH. The CLI ignores it. The function process
# is started with `node` from PATH, so it gets the --inspect-brk flag.
#
# Every request starts a NEW function process, which pauses until a debugger attaches.
# Use the VS Code config "attach to Vercel function (port 9229)". It re-attaches each time.
set -euo pipefail

PORT="${PORT:-3000}"
REAL_NODE="$(command -v node)"
SHIM_DIR="$(mktemp -d)"
trap 'rm -rf "$SHIM_DIR"' EXIT

printf '#!/bin/bash\nexec "%s" --inspect-brk=9229 "$@"\n' "$REAL_NODE" > "$SHIM_DIR/node"
chmod 755 "$SHIM_DIR/node"

echo "vercel-dev-debug: functions wait for a debugger on 127.0.0.1:9229 (real node: $REAL_NODE)"
PATH="$SHIM_DIR:$PATH" vercel dev --listen "$PORT"
