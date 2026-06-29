# Backup & Restore — `noufex_db`

> **Audience**: operators / DevOps. **Cadence**: nightly full dump +
> WAL archive continuously. **Last verified**: not yet (Phase B.4 work).
>
> This document assumes the production setup is the same as the dev
> setup described in [`README.md`](../../README.md): a single PostgreSQL
> 17 instance with the schema in [`database/`](../../database) and
> the app reading via `DATABASE_URL`.

## TL;DR

```sh
# BACKUP (nightly, run by cron / systemd timer / GitHub Action)
pg_dump --format=custom --no-owner --dbname="$DATABASE_URL" \
  > "/backups/noufex_$(date -u +%Y%m%dT%H%M%SZ).dump"

# RESTORE (one-off, on a fresh DB after an incident)
dropdb noufex_db && createdb noufex_db
pg_restore --no-owner --dbname=noufex_db "/backups/noufex_<TIMESTAMP>.dump"

# APPLY SCHEMA + SEED (only on first-time setup, NOT a restore path)
cd app && npm run db:setup
```

> **Restore is destructive.** Always run on a *new* DB; never on the
> live DB. Once you confirm the restore is good, cut traffic over.

---

## 1. What to back up

| Source              | What                    | Tool                | Frequency      | RPO  |
| ------------------- | ----------------------- | ------------------- | -------------- | ---- |
| `noufex_db`         | All schemas, data, roles | `pg_dump --format=custom` | Nightly 02:00 UTC | ≤ 24 h |
| `noufex_db` WAL     | Continuous transaction log | `archive_command`   | Continuous     | ≤ 5 min (if PITR enabled — tracked) |
| `app/dist/`         | Compiled SPA bundle     | Object storage / git | Every build    | n/a |
| `app/.env`          | Secrets, JWT secret     | **Do NOT** commit. Backup to a secrets vault (1Password / Vault / SM). | On change | n/a |

> **What we do NOT back up**: rate-limit buckets (TTL ≤ 1 h, not
> worth restoring), used-JTI table (TTL = JWT expiry), audit log…
> actually we DO back up `audit_log` — it's the only regulatory-grade
> artifact. RPO is the same as the rest of the DB.

## 2. Backup command (canonical)

```sh
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_FILE="/backups/noufex_${TIMESTAMP}.dump"
BACKUP_LATEST="/backups/noufex_latest.dump"

# 1. Dump the live DB in `custom` format (compressed, parallel-restore-safe)
pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --compress=6 \
  --jobs=$(nproc) \
  --dbname="$DATABASE_URL" \
  --file="$BACKUP_FILE"

# 2. Verify the dump is sane (pg_restore can read it)
pg_restore --list "$BACKUP_FILE" > /dev/null || {
  echo "Backup file $BACKUP_FILE is corrupt!" >&2
  exit 1
}

# 3. Refresh the `latest` symlink for tools that read the most recent file
ln -sf "$BACKUP_FILE" "$BACKUP_LATEST"

# 4. Keep last 14 nights, prune the rest
find /backups -name 'noufex_*.dump' -mtime +14 -not -name 'noufex_latest.dump' -delete
```

### Cron entry (Linux)

```cron
# /etc/cron.d/noufex-backup — root required for `pg_dump`+`psql`
15 2 * * * noufex-backup /usr/local/bin/noufex-backup.sh >> /var/log/noufex/backup.log 2>&1
```

### GitHub Action (alternative)

```yaml
# .github/workflows/backup.yml — runs every night + on demand
on:
  schedule: [{ cron: '15 2 * * *' }]
  workflow_dispatch:
jobs:
  backup:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - run: ./scripts/backup.sh
        env:
          DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}
          BACKUP_BUCKET: ${{ secrets.BACKUP_BUCKET }}
```

## 3. Restore procedure

### A. Full restore from a nightly dump

Use this when the cluster is lost but the dump files survive:

```sh
# 0. STOP the app so it stops writing to the dead DB
docker compose stop app        # or: kubectl scale deploy/app --replicas=0

# 1. Provision a fresh PostgreSQL (same major version: 17.x)
#    - follow the .env / DATABASE_URL convention
#    - make sure the role from DATABASE_URL exists with the right grants
psql -d postgres -c "CREATE ROLE noufex_app LOGIN PASSWORD '…';"
psql -d postgres -c "CREATE DATABASE noufex_db OWNER noufex_app;"

# 2. Apply roles + grants
psql "$DATABASE_URL" -f database/roles.sql

# 3. Restore the dump
pg_restore \
  --no-owner \
  --role=noufex_app \
  --dbname="$DATABASE_URL" \
  --jobs=$(nproc) \
  /backups/noufex_latest.dump

# 4. Re-apply any post-restore migrations (the dump captures the
#    "applied" set; if you need to roll forward through later
#    migrations, run database/migrations/ from 0002 onwards.
psql "$DATABASE_URL" -f database/migrations/NNNN_*.sql   # loop over

# 5. Restart the app
docker compose start app
```

### B. Point-in-time restore (PITR)

**Prerequisites**: WAL archive is enabled (`archive_mode = on`,
`archive_command = 'cp %p /wal-archive/%f'`), and the base backup you
want to roll forward from exists.

```sh
# 1. Stop the app
docker compose stop app

# 2. Boot PostgreSQL in recovery mode
echo "restore_command = 'cp /wal-archive/%f %p'" >> /etc/postgresql/17/main/postgresql.conf
echo "recovery_target_time = '2026-06-29 13:30:00 UTC'" >> /etc/postgresql/17/main/postgresql.conf
touch /var/lib/postgresql/17/main/recovery.signal
systemctl restart postgresql

# 3. Once recovery completes (watch the log), bring the app back
docker compose start app
```

### C. Logical-only restore (subset of tables)

For surgical recovery (e.g. accidentally-dropped table) use
`pg_restore --table=<name>`:

```sh
# Restore ONLY the orders table from a nightly dump
pg_restore --table=orders --dbname="$DATABASE_URL" /backups/noufex_latest.dump
```

## 4. Verifying a backup

**Schedule**: weekly (Saturday 06:00 UTC). Catch corruption early —
`pg_dump` doesn't fail loudly on every kind of data corruption, so a
test-restore is the only real verification.

```sh
# 1. Spin up a throwaway DB on the SAME major version
psql -d postgres -c "CREATE DATABASE noufex_db_verify OWNER noufex_app;"

# 2. Restore into it
pg_restore --no-owner --role=noufex_app \
  --dbname=postgresql://noufex_app@localhost/noufex_db_verify \
  /backups/noufex_latest.dump

# 3. Run smoke queries — table row counts match the live DB
psql noufex_db_verify <<SQL
SELECT 'users' tbl, COUNT(*) FROM users
UNION ALL SELECT 'stores', COUNT(*) FROM stores
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'orders', COUNT(*) FROM orders;
SQL

# 4. Tear down
psql -d postgres -c "DROP DATABASE noufex_db_verify;"
```

The row counts **must match the live DB** within ±5 % (some churn
during the restore is normal — orders get created continuously).

## 5. Disaster recovery — what to do when…

| Symptom                                | First action                                      |
| -------------------------------------- | ------------------------------------------------- |
| App can't connect to DB                | Check `DATABASE_URL` and `docker compose ps db`   |
| DB host is unreachable                 | Fail over to standby replica (out of scope today) |
| Corrupted rows / data integrity errors | Restore to verify-DB, then `pg_dump --table=…`    |
| Accidentally `DROP TABLE`              | Logical restore (§3C)                             |
| Full cluster lost                      | Provision + restore from latest dump (§3A)        |
| Bad migration applied                  | `psql … migrations/NNNN_*.sql` (manual reverse)   |

## 6. Recovery time and point objectives

| Metric                  | Today (nightly dump)    | After PITR setup            |
| ----------------------- | ----------------------- | -------------------------- |
| RPO (data loss window)  | ≤ 24 h                  | ≤ 5 min                    |
| RTO (time to recover)   | ≤ 2 h (manual)          | ≤ 30 min (mostly automated)|
| Verification cadence    | weekly                  | daily                      |

RPO/RTO numbers above are **operator-provided** — exact numbers depend
on disk throughput and `pg_dump` parallelism.

## 7. Things NOT covered (placeholders)

- **Backup of files / images** — currently in `/uploads`. Not yet
  backed up to object storage. Tracked as Phase I.6.
- **Cross-region replication** — single-region. Out of scope for
  Phase J.
- **Encryption at rest** — depends on the Postgres host's storage
  encryption. Document with the host provider.

---

**Document owner**: maintainers. Update this file when the backup
strategy changes (e.g. when PITR is rolled out).
