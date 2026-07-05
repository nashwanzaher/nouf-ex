#!/usr/bin/env bash
# ============================================================================
# apply-0024.sh — run migration 0024_production_hardening.sql as superuser
# ----------------------------------------------------------------------------
# The migration requires SUPERUSER-equivalent privileges because it:
#   - transfers table ownership
#   - grants privileges across roles
#   - drops a UNIQUE constraint
# This wrapper reads the postgres superuser password from PG_SUPERUSER_PASSWORD
# (or prompts for it) and runs the file in a single transaction.
#
# Usage:
#   ./apply-0024.sh                       # interactive — prompts for password
#   PG_SUPERUSER_PASSWORD=... ./apply-0024.sh   # non-interactive
#   DB_HOST=... DB_USER=postgres ./apply-0024.sh
#
# Notes:
#   - The script defaults to `host.docker.internal` because the canonical
#     host for this project is a Windows laptop with Postgres 17 in a
#     separate service. Override DB_HOST for staging / production hosts.
#   - Apply this ONLY when the database is at migration 0023 (already
#     applied in the production DB at the time of writing).
# ============================================================================
set -euo pipefail

DB_NAME="${DB_NAME:-noufex_db}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-host.docker.internal}"
DB_PORT="${DB_PORT:-5432}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
SQL_FILE="${SCRIPT_DIR}/database/migrations/0024_production_hardening.sql"

# Resolve a password: env var → .env file → prompt.
if [ -z "${PG_SUPERUSER_PASSWORD:-}" ]; then
    if [ -f "${SCRIPT_DIR}/.env" ]; then
        grep -E '^POSTGRES_PASSWORD=' "${SCRIPT_DIR}/.env" | head -1 \
            | sed -E 's/^POSTGRES_PASSWORD=//' \
            | tr -d '"'"'" \
            > /tmp/.pgpw_$$
        PG_SUPERUSER_PASSWORD="$(cat /tmp/.pgpw_$$)"
        rm -f /tmp/.pgpw_$$
    fi
fi

if [ -z "${PG_SUPERUSER_PASSWORD:-}" ]; then
    echo -n "Postgres superuser password for ${DB_USER}@${DB_HOST}: "
    stty -echo 2>/dev/null || true
    read -r PG_SUPERUSER_PASSWORD
    stty echo 2>/dev/null || true
    echo
fi

if [ ! -f "${SQL_FILE}" ]; then
    echo "ERROR: migration file not found: ${SQL_FILE}" >&2
    exit 1
fi

export PGPASSWORD="${PG_SUPERUSER_PASSWORD}"

echo "==> Applying migration 0024 to ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo "    File: ${SQL_FILE}"
echo

psql \
    --host="${DB_HOST}" \
    --port="${DB_PORT}" \
    --username="${DB_USER}" \
    --dbname="${DB_NAME}" \
    --variable=ON_ERROR_STOP=1 \
    --single-transaction \
    --file="${SQL_FILE}" \
    2>&1 | tee /tmp/0024-apply.log

# db-setup.cjs normally inserts the schema_migrations row AFTER running the
# file. We replicate that contract here so the run is auditable:
psql \
    --host="${DB_HOST}" \
    --port="${DB_PORT}" \
    --username="${DB_USER}" \
    --dbname="${DB_NAME}" \
    --variable=ON_ERROR_STOP=1 \
    --command="INSERT INTO schema_migrations (version, description) VALUES ('0024_production_hardening', 'Migration 0024_production_hardening') ON CONFLICT (version) DO NOTHING;" \
    2>&1 | tail -3

echo
echo "==> Migration 0024 applied. Verify with:"
echo "       psql -U ${DB_USER} -h ${DB_HOST} -d ${DB_NAME} -c \"SELECT version, applied_at FROM schema_migrations WHERE version LIKE '0024%';\""
echo "       psql -U ${DB_USER} -h ${DB_HOST} -d ${DB_NAME} -c \"\\d+ app_settings\""
echo "       psql -U ${DB_USER} -h ${DB_HOST} -d ${DB_NAME} -c \"SELECT count(*) FROM information_schema.role_table_grants WHERE grantee='noufex_readonly';\""
