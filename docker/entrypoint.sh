#!/bin/sh
# ============================================================================
# Nouf-ex API container entrypoint.
# ----------------------------------------------------------------------------
# PostgreSQL runs externally — we only start the Express API server here.
# ============================================================================
set -e

echo "[entrypoint] Starting Nouf-ex API server on port ${API_PORT:-3000}..."
cd /app
exec npx tsx server/index.ts
