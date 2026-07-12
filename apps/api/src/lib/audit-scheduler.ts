/**
 * Audit-log retention scheduler (P0, 2026-07-12).
 *
 * Runs `cleanup_audit_logs(admin_retention, search_retention)`
 * once per day at 03:00 server time. The PL/pgSQL function
 * lives at `migrations/0016_audit_log_retention.sql` and accepts
 * two retention intervals. We use the defaults seeded by
 * migration 0023:
 *
 *   - admin_retention  = 2 years (730 days)
 *   - search_retention = 90 days
 *
 * Why `node-cron` and not pg_cron / Windows Task Scheduler?
 *   1. Zero infra footprint — runs inside the same API process
 *      that's already writing the rows being purged.
 *   2. Works identically on Windows, macOS, Linux — no
 *      platform-specific cron syntax.
 *   3. Honors the dev/prod lifecycle — in test/dev environments
 *      the schedule is paused (`enabled: false`) so we don't
 *      surprise developers by silently deleting audit rows.
 *   4. Failures are logged to the structured `log` sink — the
 *      same place every other API event lands — instead of being
 *      hidden in an OS-level cron mail spool.
 *
 * Idempotency: each run is wrapped in a `SELECT cleanup_audit_logs()`
 * call. The function is itself idempotent (no-op on missing rows) and
 * locks the relevant tables with `ROW EXCLUSIVE` for the duration.
 * Re-running within the same hour is safe.
 */
import cron from 'node-cron';
import { db, log } from './shared.ts';

export interface AuditCleanupConfig {
	enabled: boolean;
	/** Cron expression for the schedule. Default: `0 3 * * *` = 03:00
	 *  every day. */
	schedule: string;
	/** Admin-row retention in days. Default: 730 (2 years). */
	adminRetentionDays: number;
	/** Search-row retention in days. Default: 90. */
	searchRetentionDays: number;
	/** Time-zone for the cron schedule. Default: UTC. */
	timezone: string;
}

const DEFAULTS: AuditCleanupConfig = {
	enabled: process.env.NODE_ENV === 'production',
	schedule: process.env.AUDIT_CLEANUP_CRON ?? '0 3 * * *',
	adminRetentionDays: Number(process.env.AUDIT_CLEANUP_ADMIN_DAYS ?? 730),
	searchRetentionDays: Number(process.env.AUDIT_CLEANUP_SEARCH_DAYS ?? 90),
	timezone: process.env.AUDIT_CLEANUP_TZ ?? 'UTC',
};

let scheduledTask: ReturnType<typeof cron.schedule> | null = null;
let running = false;
let lastRunAt: Date | null = null;
let lastRunDeleted = { admin: 0, search: 0 };

/** Run a single cleanup pass. Public so the operator can trigger it
 *  manually via `POST /api/admin/maintenance/cleanup-audit-logs`
 *  without waiting for the cron schedule. */
export async function runAuditCleanup(
	cfg: AuditCleanupConfig = DEFAULTS,
): Promise<{ deletedAdmin: number; deletedSearch: number; durationMs: number }> {
	if (running) {
		log.warn({ msg: 'audit_cleanup_already_running' });
		return { deletedAdmin: 0, deletedSearch: 0, durationMs: 0 };
	}
	running = true;
	const t0 = Date.now();
	try {
		const interval = `${cfg.adminRetentionDays} days`;
		const searchInterval = `${cfg.searchRetentionDays} days`;
		const row = (await db
			.prepare('SELECT * FROM cleanup_audit_logs($1::interval, $2::interval)')
			.get(interval, searchInterval)) as
			| { deleted_admin: number | string; deleted_search: number | string }
			| undefined;
		const deletedAdmin = Number(row?.deleted_admin ?? 0);
		const deletedSearch = Number(row?.deleted_search ?? 0);
		const durationMs = Date.now() - t0;
		lastRunAt = new Date();
		lastRunDeleted = { admin: deletedAdmin, search: deletedSearch };
		log.info({
			msg: 'audit_cleanup_run',
			deletedAdmin,
			deletedSearch,
			durationMs,
			adminRetentionDays: cfg.adminRetentionDays,
			searchRetentionDays: cfg.searchRetentionDays,
		});
		return { deletedAdmin, deletedSearch, durationMs };
	} catch (err) {
		log.error({
			msg: 'audit_cleanup_failed',
			error: err instanceof Error ? err.message : String(err),
		});
		throw err;
	} finally {
		running = false;
	}
}

/** Start the cron schedule. Returns a teardown function. Safe to
 *  call repeatedly — the second call is a no-op. */
export function startAuditCleanupScheduler(
	override?: Partial<AuditCleanupConfig>,
): () => void {
	const cfg: AuditCleanupConfig = { ...DEFAULTS, ...override };
	if (scheduledTask) return stopAuditCleanupScheduler;
	if (!cfg.enabled) {
		log.info({ msg: 'audit_cleanup_scheduler_disabled' });
		return () => {};
	}
	if (!cron.validate(cfg.schedule)) {
		log.error({
			msg: 'audit_cleanup_invalid_schedule',
			schedule: cfg.schedule,
		});
		return () => {};
	}
	scheduledTask = cron.schedule(
		cfg.schedule,
		() => {
			// Wrap in IIFE so an unexpected throw doesn't kill the
			// schedule node-cron maintains internally.
			runAuditCleanup(cfg).catch(() => undefined);
		},
		{ timezone: cfg.timezone },
	);
	log.info({
		msg: 'audit_cleanup_scheduler_started',
		schedule: cfg.schedule,
		timezone: cfg.timezone,
		adminRetentionDays: cfg.adminRetentionDays,
		searchRetentionDays: cfg.searchRetentionDays,
	});
	return stopAuditCleanupScheduler;
}

export function stopAuditCleanupScheduler(): void {
	if (scheduledTask) {
		scheduledTask.stop();
		scheduledTask = null;
		log.info({ msg: 'audit_cleanup_scheduler_stopped' });
	}
}

/** Introspection — used by `/api/admin/system` (future) to surface
 *  the next scheduled run. */
export function auditCleanupStatus(): {
	running: boolean;
	enabled: boolean;
	lastRunAt: Date | null;
	lastRunDeleted: { admin: number; search: number };
	config: AuditCleanupConfig;
} {
	return {
		running,
		enabled: DEFAULTS.enabled,
		lastRunAt,
		lastRunDeleted,
		config: DEFAULTS,
	};
}
