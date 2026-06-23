#!/bin/sh
# ============================================================================
# Nouf-ex API container entrypoint.
# ----------------------------------------------------------------------------
# PostgreSQL runs externally (on the host). Docker may start the container
# before Postgres is ready, so we poll the DB until it accepts connections
# (up to 60 s). Then we exec the API.
# ============================================================================
set -e

echo "[entrypoint] Nouf-ex API container starting..."
echo "[entrypoint] Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT:-5432}/${DB_NAME}..."

# Wait up to 60 s for the DB to accept a TCP connection. We use a small
# Node script (already in the image) instead of installing psql or
# pg_isready.
node -e "
const net = require('net');
const host = process.env.DB_HOST || 'host.docker.internal';
const port = +(process.env.DB_PORT || 5432);
const start = Date.now();
const timeout = 60_000;
const retryMs = 1_000;

function attempt() {
  return new Promise((resolve) => {
    const sock = net.createConnection({ host, port });
    let done = false;
    const finish = (ok) => { if (!done) { done = true; sock.destroy(); resolve(ok); } };
    sock.setTimeout(2_000);
    sock.once('connect', () => finish(true));
    sock.once('error', () => finish(false));
    sock.once('timeout', () => finish(false));
  });
}

(async () => {
  while (Date.now() - start < timeout) {
    if (await attempt()) {
      console.log('[entrypoint] DB reachable after ' + Math.round((Date.now()-start)/1000) + 's');
      process.exit(0);
    }
    await new Promise(r => setTimeout(r, retryMs));
  }
  console.error('[entrypoint] FATAL: DB not reachable after ' + (timeout/1000) + 's');
  process.exit(1);
})();
"

echo "[entrypoint] Starting Nouf-ex API server on port ${API_PORT:-3000}..."
cd /app
exec npx tsx server/index.ts
