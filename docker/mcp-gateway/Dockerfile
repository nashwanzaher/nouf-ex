# syntax=docker/dockerfile:1.7
# ============================================================================
# Nouf-ex MCP server — OCI image (consumed by docker/mcp-gateway).
# ----------------------------------------------------------------------------
# Builds apps/mcp-server to dist/index.js and packages it into a minimal
# Node 20 alpine image. The gateway spawns one of these per session and
# proxies MCP messages between SSE (port 8811) and stdio (this container's
# node process).
# ============================================================================
FROM node:20-alpine AS build

WORKDIR /build

COPY package.json package-lock.json* ./
COPY apps/mcp-server/package.json ./apps/mcp-server/
COPY packages/typescript-config/package.json ./packages/typescript-config/

RUN npm ci --no-audit --no-fund --workspaces --include-workspace-root

COPY packages/ ./packages/
COPY apps/mcp-server/ ./apps/mcp-server/

RUN cd /build/apps/mcp-server && npx tsc -p tsconfig.json

# ----------------------------------------------------------------------------
# Runtime image.
# ----------------------------------------------------------------------------
FROM node:20-alpine AS runtime

WORKDIR /app

# Hoisted deps (pg, dotenv, zod, MCP SDK) are needed at runtime.
COPY --from=build /build/node_modules ./node_modules

# The compiled MCP server bundle.
COPY --from=build /build/apps/mcp-server/dist ./dist
COPY --from=build /build/apps/mcp-server/package.json ./package.json

# Drop privileges (matches the official node image convention).
USER node

ENV NODE_ENV=production

ENTRYPOINT ["node", "/app/dist/index.js"]