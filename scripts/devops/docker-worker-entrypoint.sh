#!/bin/sh
# ============================================================================
# Worker entrypoint (Tier 1.4).
# ----------------------------------------------------------------------------
# Boots the bundled worker.js with the same environment conventions as
# the API container.
# ============================================================================
set -e

echo "▶ noufex-worker: starting…"

# Resolve the API dist directory. The Dockerfile copies apps/api/dist
# next to apps/api/package.json; this script assumes that layout.
if [ ! -f /app/apps/api/dist/worker.js ]; then
	echo "✗ /app/apps/api/dist/worker.js not found" >&2
	exit 1
fi

# Pass through. The real work (consumer setup, signal handling) is
# inside worker.ts → worker.js.
exec node /app/apps/api/dist/worker.js