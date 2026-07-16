#!/bin/sh
# ============================================================================
# Nouf-ex API container entrypoint (monorepo layout).
# ----------------------------------------------------------------------------
# PostgreSQL runs externally (on the host). Docker may start the container
# before Postgres is ready, so we poll the DB until it accepts connections
# (up to 60 s). Then we exec the API from the new path /app/apps/api/dist/.
#
# Security notes (NIST SP 800-53):
#   - Uses shell-native TCP check (no Node.js dependency for probe)
#   - Proper signal forwarding via exec (PID 1 → Node)
#   - Fails fast if DB is unreachable (60s timeout)
# ============================================================================
set -eu

echo "[entrypoint] Nouf-ex API container starting..."
echo "[entrypoint] Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT:-5432}/${DB_NAME}..."

# Use shell-native TCP check via /dev/tcp (POSIX, no extra binaries).
# Falls back to node net module if /dev/tcp is not available (Alpine).
wait_for_db() {
  local host="${DB_HOST:-host.docker.internal}"
  local port="${DB_PORT:-5432}"
  local start=$(date +%s)
  local timeout=60
  local delay=1

  while true; do
    local now=$(date +%s)
    local elapsed=$((now - start))
    if [ "$elapsed" -ge "$timeout" ]; then
      echo "[entrypoint] FATAL: DB not reachable after ${timeout}s"
      return 1
    fi

    # Try /dev/tcp (bash) or node net (POSIX sh / Alpine)
    if command -v bash >/dev/null 2>&1; then
      if (echo > /dev/tcp/"$host"/"$port") 2>/dev/null; then
        echo "[entrypoint] DB reachable after ${elapsed}s"
        return 0
      fi
    else
      # Alpine / POSIX fallback — use node for TCP check
      if node -e "
        const net = require('net');
        const sock = net.createConnection({ host: '$host', port: $port });
        let done = false;
        const finish = (ok) => { if (!done) { done = true; sock.destroy(); process.exit(ok ? 0 : 1); } };
        sock.setTimeout(2000);
        sock.once('connect', () => finish(true));
        sock.once('error', () => finish(false));
        sock.once('timeout', () => finish(false));
      " 2>/dev/null; then
        echo "[entrypoint] DB reachable after ${elapsed}s"
        return 0
      fi
    fi

    # Exponential backoff: 1s, 2s, 4s, 5s (capped)
    sleep $delay
    delay=$((delay * 2))
    if [ "$delay" -gt 5 ]; then delay=5; fi
  done
}

wait_for_db

echo "[entrypoint] Creating uploads directories..."
mkdir -p /app/uploads/images /app/uploads/documents /app/uploads/videos

echo "[entrypoint] Starting Nouf-ex API server on port ${API_PORT:-3000}..."
cd /app
# Run the esbuild-bundled ESM output produced by the build stage of
# the Dockerfile. The bundle resolves every relative import at build
# time so we don't need a tsx loader at runtime. The source files
# are intentionally NOT shipped in the image.
exec node apps/api/dist/index.js
