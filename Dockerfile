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

ENV npm_config_loglevel=error \
    # PATCH (noufex): bump the per-request fetch / idle timeout for
    # `npm ci` against registry.npmjs.org. The default 5-minute idle
    # window is too tight for a fresh `npm ci` of 877 packages on
    # slower links — we observed `EIDLETIMEOUT` after ~20 min of
    # cumulative work, which aborts the entire build stage. 30 min
    # per request is generous and well under the next failure mode
    # (container OOM from holding half-fetched tarballs).
    npm_config_fetch_timeout=1800000 \
    npm_config_fetch_retries=3 \
    npm_config_fetch_retry_mintimeout=20000 \
    npm_config_fetch_retry_maxtimeout=120000
WORKDIR /build

COPY app/package.json app/package-lock.json* ./
RUN npm ci --no-audit --no-fund --fetch-timeout=1800000 --fetch-retries=3

# ----------------------------------------------------------------------------
# Stage 2: build the API server bundle with esbuild.
# ----------------------------------------------------------------------------
# esbuild resolves every relative import at build time, so the
# runtime image only needs to execute a single ESM file. External
# packages (`pg`, `express`, `cors`, etc.) stay in node_modules.
# ----------------------------------------------------------------------------
FROM node:20-alpine AS build

ENV npm_config_loglevel=error
WORKDIR /build

COPY --from=deps /build/node_modules ./node_modules
COPY app/ ./app/

RUN cd /build/app && npx esbuild server/index.ts \
        --bundle \
        --platform=node \
        --target=node20 \
        --format=esm \
        --outfile=/build/app/server/index.js \
        --packages=external

# ----------------------------------------------------------------------------
# Stage 3: runtime image — Node.js 20 + the bundled Nouf-ex API server.
# ----------------------------------------------------------------------------
FROM node:20-alpine

RUN apk add --no-cache tini

WORKDIR /app

# node_modules carries every external dep the bundle requires at
# runtime (pg, express, cors, zod, scrypt via crypto, etc.).
COPY --from=deps /build/node_modules ./node_modules

# Copy the esbuild-bundled CJS, plus the SPA dist (built by
# `npm run build` on the host before `docker compose build`). The
# raw .ts/.cts sources are NOT copied — the bundle is self-contained
# and we don't want the runtime to even consider loading them.
COPY --from=build /build/app/server/index.js ./server/index.js
COPY --from=build /build/app/package.json ./package.json
COPY --from=build /build/app/dist ./dist

# Copy the API entrypoint.
COPY scripts/devops/docker-entrypoint.sh /usr/local/bin/noufex-entrypoint.sh
RUN chmod +x /usr/local/bin/noufex-entrypoint.sh

# Drop root: the official `node:20-alpine` image already ships a
# `node` user (uid=1000). We just need to make /app writable for
# that user. The `node` user is a system account (no password, no
# shell), which is the right shape for a long-running service.
RUN chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => { if (r.statusCode !== 200) process.exit(1) })" || exit 1

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/noufex-entrypoint.sh"]
