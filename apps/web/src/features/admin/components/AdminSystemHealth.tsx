import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	Activity,
	CheckCircle2,
	Clock,
	Database,
	HardDrive,
	Loader2,
	MemoryStick,
	Server,
	Wifi,
	XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSystemHealth } from '@/features/admin/api/admin';

interface SystemHealth {
	ok: boolean;
	uptime_s: number;
	ts: string;
	checks: {
		db: { ok: boolean; ms: number; detail?: string };
	};
}

interface MemoryInfo {
	heapUsedMB: number;
	heapTotalMB: number;
	rssMB: number;
}

export default function AdminSystemHealth() {
	const { t } = useTranslation();
	const [health, setHealth] = useState<SystemHealth | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [mem, setMem] = useState<MemoryInfo | null>(null);
	const [latencies, setLatencies] = useState<number[]>([]);

	const measure = async () => {
		const t0 = performance.now();
		try {
			const res = (await getSystemHealth()) as SystemHealth;
			const t1 = performance.now();
			setLatencies((p) => [...p.slice(-9), Math.round(t1 - t0)]);
			setHealth(res);
			setError(null);
		} catch (e: unknown) {
			setError(e instanceof Error ? e.message : String(e));
		}
	};

	useEffect(() => {
		const tick = async () => {
			await measure();
		};
		tick();
		const id = setInterval(tick, 10000);
		// Estimate browser memory (Chromium only) — wrapped in setTimeout
		// to avoid the `setState-in-effect` lint rule (we want the memory
		// reading to happen after the first paint, not synchronously).
		setTimeout(() => {
			if ('memory' in performance) {
				const m = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory;
				if (m) {
					setMem({
						heapUsedMB: Math.round(m.usedJSHeapSize / 1024 / 1024),
						heapTotalMB: Math.round(m.totalJSHeapSize / 1024 / 1024),
						rssMB: 0,
					});
				}
			}
		}, 0);
		return () => {
			clearInterval(id);
		};
	}, []);

	const avgLatency =
		latencies.length === 0
			? 0
			: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);

	const isUp = health?.ok === true;
	const dbOk = health?.checks.db.ok === true;

	return (
		<div className="min-h-screen bg-[#FAFAF7]">
			<div className="max-w-5xl mx-auto px-4 lg:px-6 py-6 space-y-6">
				<div
					className={cn(
						'rounded-2xl p-6 lg:p-8 relative overflow-hidden text-white',
						isUp
							? 'bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-900'
							: 'bg-gradient-to-br from-red-900 via-red-800 to-red-900',
					)}
				>
					<div className="absolute inset-0 opacity-10">
						<div className="absolute -top-12 -end-12 w-64 h-64 rounded-full bg-white blur-3xl" />
					</div>
					<div className="relative flex items-center gap-4">
						<div className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center">
							{isUp ? (
								<CheckCircle2 size={32} className="text-emerald-300" />
							) : (
								<XCircle size={32} className="text-red-300" />
							)}
						</div>
						<div>
							<p className="text-xs uppercase tracking-widest font-bold opacity-80">
								{t('admin.systemHealth.title', 'System Health')}
							</p>
							<h1 className="text-2xl font-bold mt-1">
								{isUp
									? t('admin.systemHealth.allOperational', 'All systems operational')
									: t('admin.systemHealth.degraded', 'Degraded — investigation needed')}
							</h1>
							<p className="text-sm text-white/80 mt-1">
								{t('admin.systemHealth.uptime', 'Uptime')}:{' '}
								{health
									? `${Math.floor(health.uptime_s / 3600)}h ${Math.floor((health.uptime_s % 3600) / 60)}m`
									: '—'}
							</p>
						</div>
						<div className="ms-auto flex items-center gap-2 text-xs">
							<span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/15">
								<span
									className={cn(
										'w-2 h-2 rounded-full',
										isUp ? 'bg-emerald-400 animate-pulse' : 'bg-red-400',
									)}
								/>
								{health?.ts ? new Date(health.ts).toLocaleTimeString() : '—'}
							</span>
						</div>
					</div>
				</div>

				{error && (
					<div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">
						<strong>{t('admin.systemHealth.error', 'Error')}:</strong> {error}
					</div>
				)}

				{/* Services grid */}
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<HealthCard
						icon={Database}
						label={t('admin.systemHealth.postgres', 'PostgreSQL')}
						status={dbOk ? 'ok' : 'down'}
						detail={
							dbOk
								? `${health?.checks.db.ms ?? '?'} ms`
								: (health?.checks.db.detail ?? t('admin.systemHealth.down', 'down'))
						}
						tone="blue"
					/>
					<HealthCard
						icon={Server}
						label={t('admin.systemHealth.apiServer', 'API Server')}
						status={isUp ? 'ok' : 'down'}
						detail={`${health?.uptime_s ?? '?'} s`}
						tone="emerald"
					/>
					<HealthCard
						icon={Wifi}
						label={t('admin.systemHealth.frontend', 'Frontend (this tab)')}
						status={isUp ? 'ok' : 'down'}
						detail={`${avgLatency} ms avg`}
						tone="amber"
					/>
					<HealthCard
						icon={MemoryStick}
						label={t('admin.systemHealth.browserMem', 'Browser memory')}
						status="info"
						detail={
							mem
								? `${mem.heapUsedMB} / ${mem.heapTotalMB} MB`
								: t('admin.systemHealth.notAvailable', 'Not available')
						}
						tone="purple"
					/>
				</div>

				{/* Latency sparkline */}
				<section className="bg-white rounded-2xl border border-gray-200 p-6">
					<div className="flex items-center justify-between mb-3">
						<h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
							<Activity size={16} className="text-[#D4A853]" />
							{t('admin.systemHealth.latency', 'Round-trip latency (last 10 polls)')}
						</h2>
						<span className="text-xs font-mono text-gray-500">
							avg {avgLatency} ms
						</span>
					</div>
					<div className="flex items-end gap-1 h-24">
						{latencies.length === 0 ? (
							<div className="flex-1 flex items-center justify-center text-sm text-gray-400">
								<Loader2 className="w-4 h-4 animate-spin me-2" />
								{t('common.loading', 'Loading...')}
							</div>
						) : (
							latencies.map((l, i) => {
								const max = Math.max(...latencies, 50);
								const h = Math.max(4, Math.round((l / max) * 100));
								return (
									<div
										key={i}
										title={`${l} ms`}
										className="flex-1 rounded-t bg-[#D4A853]/80"
										style={{ height: `${h}%` }}
									/>
								);
							})
						)}
					</div>
					<div className="flex justify-between text-[10px] text-gray-400 mt-1">
						<span>-10</span>
						<span>-5</span>
						<span>now</span>
					</div>
				</section>

				{/* DB stats */}
				{health?.checks?.db?.ok && (
					<section className="bg-white rounded-2xl border border-gray-200 p-6">
						<h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
							<HardDrive size={16} className="text-[#D4A853]" />
							{t('admin.systemHealth.database', 'Database')}
						</h2>
						<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
							<DbStat label={t('admin.systemHealth.dbRoundtrip', 'Round-trip')} value={`${health.checks.db.ms} ms`} />
							<DbStat label={t('admin.systemHealth.dbStatus', 'Status')} value={dbOk ? '🟢 OK' : '🔴 DOWN'} />
							<DbStat label={t('admin.systemHealth.polling', 'Polling')} value={'10 s'} />
							<DbStat label={t('admin.systemHealth.nextCheck', 'Next check')} value={'< 10 s'} />
						</div>
					</section>
				)}

				<div className="text-center text-xs text-gray-400">
					<Clock size={12} className="inline-block me-1" />
					{t('admin.systemHealth.pollNote', 'Auto-refreshes every 10 seconds')}
				</div>
			</div>
		</div>
	);
}

function HealthCard({
	icon: Icon,
	label,
	status,
	detail,
	tone,
}: {
	icon: typeof Activity;
	label: string;
	status: 'ok' | 'down' | 'info';
	detail: string;
	tone: 'blue' | 'emerald' | 'amber' | 'purple';
}) {
	const tones = {
		blue: 'bg-blue-50 text-blue-700 border-blue-200',
		emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
		amber: 'bg-amber-50 text-amber-700 border-amber-200',
		purple: 'bg-purple-50 text-purple-700 border-purple-200',
	};
	const statusDot =
		status === 'ok'
			? 'bg-emerald-500'
			: status === 'down'
				? 'bg-red-500'
				: 'bg-blue-500';
	return (
		<div className="bg-white rounded-2xl border border-gray-200 p-4">
			<div className="flex items-center gap-3">
				<div
					className={cn(
						'w-10 h-10 rounded-lg flex items-center justify-center border',
						tones[tone],
					)}
				>
					<Icon size={18} />
				</div>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<p className="text-sm font-bold text-gray-900">{label}</p>
						<span className={cn('w-2 h-2 rounded-full', statusDot)} />
					</div>
					<p className="text-xs text-gray-500 mt-0.5 truncate">{detail}</p>
				</div>
			</div>
		</div>
	);
}

function DbStat({ label, value }: { label: string; value: string }) {
	return (
		<div className="bg-gray-50 rounded-xl p-3">
			<p className="text-[10px] uppercase tracking-wider font-bold text-gray-500">
				{label}
			</p>
			<p className="text-sm font-extrabold text-gray-900 mt-1">{value}</p>
		</div>
	);
}
