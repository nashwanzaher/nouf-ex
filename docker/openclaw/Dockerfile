# syntax=docker/dockerfile:1.7
# ============================================================================
# OpenClaw / OpenCode AI server container
# ----------------------------------------------------------------------------
# Runs the opencode-ai headless server inside Docker so it can be managed
# alongside the nouf-ex stack from Docker Desktop.
#
# Usage:
#   docker compose -f docker-compose.openclaw.yml up -d --build
# ============================================================================

FROM node:20-alpine

# opencode-ai postinstall downloads a native binary; allow it to run.
ENV npm_config_loglevel=error \
    OPENCODE_CONFIG_DIR=/data/.openclaw \
    OPENCODE_STATE_DIR=/data/.openclaw \
    NODE_ENV=production

# Install dependencies required by the opencode-ai native binary and runtime.
RUN apk add --no-cache \
    ca-certificates \
    curl \
    git \
    libc6-compat \
    libstdc++

# Install opencode-ai globally. The package downloads the Linux binary on
# postinstall, so we do NOT copy the host's Windows .exe into the image.
RUN npm install -g opencode-ai@1.17.18 --no-audit --no-fund

# Runtime user / directories. We keep state in /data so it can be persisted
# with a named volume and survive container restarts.
RUN mkdir -p /data/.openclaw /workspace && \
    chown -R node:node /data /workspace

USER node
WORKDIR /workspace

# The project root will be bind-mounted here from the host.
VOLUME ["/workspace"]

# Persist OpenClaw config, sessions, and memory.
VOLUME ["/data/.openclaw"]

EXPOSE 3001

# Basic-auth credentials are supplied at runtime via environment variables.
# Do NOT hard-code secrets in this image.
ENV OPENCODE_SERVER_USERNAME=noufexAI \
    OPENCODE_SERVER_PASSWORD=656650

ENTRYPOINT ["opencode"]
CMD ["serve", "--port", "3001", "--hostname", "0.0.0.0"]
