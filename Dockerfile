# syntax=docker/dockerfile:1.7
# ============================================================================
# Nouf-ex — Monorepo multi-service image.
# ----------------------------------------------------------------------------
# Builds:
#   - The Express API from apps/api/ (esbuild → single ESM bundle).
#   - The React SPA from apps/web/ (vite → apps/web/dist).
# The database schema lives in packages/db/ (SQL files, NOT bundled into
# the image; provisioned separately via `npm run db:setup` on the host).
#
# Best-practice highlights:
#   - Multi-stage build keeps the runtime image small (~150 MB).
#   - npm workspaces hoist deps to root /node_modules; we copy the
#     whole tree so both apps resolve their externals from one place.
#   - `--ignore-scripts` in `npm ci` skips postinstall hooks that
#     would otherwise re-download binaries on every layer.
#   - The official `node:20-alpine` already ships a `node` user; we
#     just chown /app and switch to it (no root at runtime).
# ============================================================================

# ----------------------------------------------------------------------------
# Stage 1: install npm dependencies (workspace-wide).
# ----------------------------------------------------------------------------
FROM node:20-alpine AS deps

ENV npm_config_loglevel=error \
    npm_config_fetch_timeout=1800000 \
    npm_config_fetch_retries=3 \
    npm_config_fetch_retry_mintimeout=20000 \
    npm_config_fetch_retry_maxtimeout=120000
WORKDIR /build

# Copy every workspace package.json + the root lockfile. `npm ci` at
# the root resolves workspaces and installs all deps in one shot.
COPY package.json package-lock.json* ./
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/mcp-server/package.json ./apps/mcp-server/

RUN npm ci --no-audit --no-fund \
    --fetch-timeout=1800000 --fetch-retries=3 \
    --workspaces --include-workspace-root

# ----------------------------------------------------------------------------
# Stage 2: build the Express API bundle (esbuild, ESM, external deps).
# ----------------------------------------------------------------------------
FROM node:20-alpine AS api-build

WORKDIR /build
COPY --from=deps /build/node_modules ./node_modules
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

RUN cd /build/apps/api && npx esbuild src/index.ts \
        --bundle \
        --platform=node \
        --target=node20 \
        --format=esm \
        --outfile=/build/apps/api/dist/index.js \
        --packages=external

# ----------------------------------------------------------------------------
# Stage 3: build the React SPA bundle (vite, hashed assets, PWA precache).
# ----------------------------------------------------------------------------
FROM node:20-alpine AS web-build

WORKDIR /build
COPY --from=deps /build/node_modules ./node_modules
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

RUN cd /build/apps/web && npx vite build

# ----------------------------------------------------------------------------
# Stage 4: runtime image — API + SPA + node user + tini + healthcheck.
# ----------------------------------------------------------------------------
FROM node:20-alpine AS runtime

RUN apk add --no-cache tini

WORKDIR /app

# node_modules (root + workspace packages) — hoisted by `npm ci`.
COPY --from=deps /build/node_modules ./node_modules

# Bundled API + its package.json (for the bin entry).
COPY --from=api-build /build/apps/api/dist ./apps/api/dist
COPY --from=api-build /build/apps/api/package.json ./apps/api/package.json

# Pre-built SPA assets served as static by the API in production.
COPY --from=web-build /build/apps/web/dist ./apps/web/dist

# Container entrypoint: copies /apps/api/dist into the path the
# API expects (server/index.js) and runs it. We deliberately do NOT
# ship the .ts source — the bundle is self-contained.
COPY scripts/devops/docker-entrypoint.sh /usr/local/bin/noufex-entrypoint.sh
RUN chmod +x /usr/local/bin/noufex-entrypoint.sh

RUN chown -R node:node /app

USER node

ENV NODE_ENV=production \
    API_PORT=3000 \
    HOST=0.0.0.0

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e 'require("http").get("http://localhost:3000/api/health", (r) => { if (r.statusCode !== 200) process.exit(1) })' || exit 1

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/noufex-entrypoint.sh"]