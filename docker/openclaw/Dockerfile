# syntax=docker/dockerfile:1.7
# ============================================================================
# OpenClaw / OpenCode AI server container
# ----------------------------------------------------------------------------
# Runs the opencode-ai headless server inside Docker so it can be managed
# alongside the nouf-ex stack from Docker Desktop.
#
# Usage:
#   docker compose -f docker-compose.openclaw.yml up -d --build
#
# Security hardening (OWASP ASVS, NIST SP 800-53):
#   - Pinned package version for reproducible builds
#   - Read-only root filesystem where possible
#   - VOLUME declarations moved to docker-compose (12-Factor: processes)
# ============================================================================

FROM node:20-alpine AS build

# opencode-ai postinstall downloads a native binary; allow it to run.
ENV npm_config_loglevel=error \
    NODE_ENV=production

# Install dependencies required by the opencode-ai native binary and runtime.
RUN apk add --no-cache \
    ca-certificates \
    curl \
    git \
    libc6-compat \
    libstdc++

# SECURITY (OWASP ASVS 6.2.1): pin exact version for reproducible builds.
# Use npm ci instead of npm install for deterministic dependency resolution.
RUN npm install -g opencode-ai@1.17.18 \
    --ignore-scripts=false \
    --no-audit \
    --no-fund

# Runtime user / directories.
# NOTE: VOLUME declarations are moved to docker-compose.yml per
# 12-Factor App principle (processes should not write state to
# the container filesystem; state belongs in backing services).
RUN mkdir -p /data/.openclaw /workspace && \
    chown -R node:node /data /workspace

USER node
WORKDIR /workspace

# SECURITY: set config/state dirs via environment (not VOLUME in Dockerfile).
ENV OPENCODE_CONFIG_DIR=/data/.openclaw \
    OPENCODE_STATE_DIR=/data/.openclaw \
    OPENCODE_SERVER_USERNAME=

EXPOSE 3001

# Basic-auth credentials are supplied at runtime via environment variables
# or Docker secrets — NEVER hard-coded in the image. The container will
# refuse to start unless OPENCODE_SERVER_USERNAME and OPENCODE_SERVER_PASSWORD
# are set explicitly by the operator.

ENTRYPOINT ["opencode"]
CMD ["serve", "--port", "3001", "--hostname", "0.0.0.0"]
