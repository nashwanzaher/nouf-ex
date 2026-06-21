# syntax=docker/dockerfile:1.7
# ============================================================================
# Nouf-ex — API image (connects to an existing external PostgreSQL 17).
# ----------------------------------------------------------------------------
# The Postgres server is expected to be reachable from the container. On
# Docker Desktop (Win/Mac), use `host.docker.internal` as DB_HOST. On Linux,
# use the host's IP or run with `--network=host`.
#
# The database schema is provisioned once on the HOST via `npm run db:setup`
# — those SQL files are NOT shipped inside this image.
# ============================================================================

# ----------------------------------------------------------------------------
# Stage 1: install npm dependencies.
# ----------------------------------------------------------------------------
FROM node:20-alpine AS deps

ENV npm_config_loglevel=error
WORKDIR /build

COPY app/package.json app/package-lock.json* ./
RUN npm ci --no-audit --no-fund

# ----------------------------------------------------------------------------
# Stage 2: runtime image — Node.js 20 + the Nouf-ex API server.
# ----------------------------------------------------------------------------
FROM node:20-alpine

RUN apk add --no-cache tini

WORKDIR /app

COPY --from=deps /build/node_modules ./node_modules
COPY app/ ./

# Copy the API entrypoint.
COPY docker/entrypoint.sh /usr/local/bin/noufex-entrypoint.sh
RUN chmod +x /usr/local/bin/noufex-entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/stats/home', (r) => { if (r.statusCode !== 200) process.exit(1) })" || exit 1

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/noufex-entrypoint.sh"]
