import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	Copy,
	Loader2,
	Percent,
	Plus,
	Save,
	Ticket,
	Trash2,
	X,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { cn } from '@/lib/utils';
import {
	createAdminCoupon,
	deleteAdminCoupon,
	getAdminCoupons,
	patchAdminCoupon,
	type AdminCoupon,
} from '@/features/admin/api/admin';

export default function AdminCoupons() {
	const { t } = useTranslation();
	const { addToast } = useApp();
	const [items, setItems] = useState<AdminCoupon[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState('');
	const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
	const [editing, setEditing] = useState<AdminCoupon | null>(null);
	const [creating, setCreating] = useState(false);
	const [draft, setDraft] = useState<Partial<AdminCoupon>>({});
	const [saving, setSaving] = useState(false);

	const reload = async () => {
		setLoading(true);
		try {
			const res = await getAdminCoupons();
			setItems(res.items);
		} catch (e: unknown) {
			addToast({
				type: 'error',
				message: e instanceof Error ? e.message : String(e),
			});
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		(async () => {
			setLoading(true);
			try {
				const res = await getAdminCoupons();
				setItems(res.items);
			} catch (e: unknown) {
				addToast({
					type: 'error',
					message: e instanceof Error ? e.message : String(e),
				});
			} finally {
				setLoading(false);
			}
		})();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const filtered = useMemo(() => {
		return items.filter((c) => {
			if (statusFilter === 'active' && !c.is_active) return false;
			if (statusFilter === 'inactive' && c.is_active) return false;
			if (
				search &&
				!`${c.code} ${c.description ?? ''}`
					.toLowerCase()
					.includes(search.toLowerCase())
			)
				return false;
			return true;
		});
	}, [items, search, statusFilter]);

	const handleSave = async () => {
		setSaving(true);
		try {
			if (editing) {
				await patchAdminCoupon(editing.id, draft);
				addToast({ type: 'success', message: t('common.saved', 'Saved') });
			} else {
				await createAdminCoupon({
					type: 'percentage',
					value: 10,
					is_active: true,
					per_user_limit: 1,
					min_order_amount: 0,
					...draft,
				});
				addToast({ type: 'success', message: t('common.saved', 'Created') });
			}
			setEditing(null);
			setCreating(false);
			setDraft({});
			reload();
		} catch (e: unknown) {
			addToast({
				type: 'error',
				message: e instanceof Error ? e.message : String(e),
			});
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async (c: AdminCoupon) => {
		if (!confirm(t('admin.coupons.confirmDelete', 'Delete this coupon permanently?')))
			return;
		try {
			await deleteAdminCoupon(c.id);
			addToast({ type: 'success', message: t('common.saved', 'Deleted') });
			reload();
		} catch (e: unknown) {
			addToast({
				type: 'error',
				message: e instanceof Error ? e.message : String(e),
			});
		}
	};

	const counts = useMemo(
		() => ({
			active: items.filter((c) => c.is_active).length,
			inactive: items.filter((c) => !c.is_active).length,
			redemptions: items.reduce((s, c) => s + c.usage_count, 0),
		}),
		[items],
	);

	return (
		<div className="min-h-screen bg-[#FAFAF7]">
			<div className="max-w-6xl mx-auto px-4 lg:px-6 py-6 space-y-6">
				<div className="rounded-2xl bg-gradient-to-br from-[#1A1612] via-[#2A2420] to-[#1A1612] text-white p-6 lg:p-8 relative overflow-hidden">
					<div className="absolute inset-0 opacity-10">
						<div className="absolute -top-12 -end-12 w-64 h-64 rounded-full bg-[#D4A853] blur-3xl" />
					</div>
					<div className="relative flex flex-wrap items-center justify-between gap-4">
						<div className="flex items-center gap-4">
							<div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center">
								<Ticket size={26} className="text-[#D4A853]" />
							</div>
							<div>
								<p className="text-xs uppercase tracking-widest text-[#D4A853] font-bold">
									{t('admin.navCoupons', 'Marketing')}
								</p>
								<h1 className="text-xl font-bold mt-1">
									{t('admin.coupons.title', 'Coupons')}
								</h1>
								<p className="text-sm text-white/60 mt-1">
									{counts.active} {t('admin.coupons.activeCount', 'active')} ·{' '}
									{counts.redemptions} {t('admin.coupons.redemptions', 'redemptions')}
								</p>
							</div>
						</div>
						<button
							type="button"
							onClick={() => {
								setCreating(true);
								setEditing(null);
								setDraft({ type: 'percentage', value: 10, is_active: true });
							}}
							className="px-4 py-2 rounded-full bg-[#D4A853] hover:bg-[#B8923F] text-sm font-bold inline-flex items-center gap-2"
						>
							<Plus size={14} />
							{t('admin.coupons.new', 'New Coupon')}
						</button>
					</div>
				</div>

				<div className="grid grid-cols-3 gap-3">
					<Stat
						label={t('admin.coupons.totalLabel', 'Total')}
						value={String(items.length)}
						tone="amber"
					/>
					<Stat
						label={t('admin.coupons.activeLabel', 'Active')}
						value={String(counts.active)}
						tone="emerald"
					/>
					<Stat
						label={t('admin.coupons.redemptionsLabel', 'Redemptions')}
						value={String(counts.redemptions)}
						tone="blue"
					/>
				</div>

				<div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
					<div className="p-4 border-b border-gray-100 flex flex-wrap gap-2">
						<input
							type="text"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder={t('common.search', 'Search by code...')}
							className="flex-1 min-w-[200px] h-10 px-4 border border-gray-300 rounded-lg text-sm focus:border-[#D4A853] focus:ring-1 focus:ring-[#D4A853] outline-none"
						/>
						<div className="inline-flex rounded-full bg-gray-100 p-1 text-xs font-bold">
							{(['all', 'active', 'inactive'] as const).map((k) => (
								<button
									key={k}
									type="button"
									onClick={() => setStatusFilter(k)}
									className={cn(
										'px-4 py-1.5 rounded-full transition-colors',
										statusFilter === k
											? 'bg-white text-gray-900 shadow-sm'
											: 'text-gray-500',
									)}
								>
									{t(`admin.coupons.${k}`, k)}
								</button>
							))}
						</div>
					</div>

					{loading ? (
						<div className="p-12 flex items-center justify-center">
							<Loader2 className="w-6 h-6 animate-spin text-gray-400" />
						</div>
					) : filtered.length === 0 ? (
						<div className="p-12 text-center text-sm text-gray-500">
							{t('admin.coupons.empty', 'No coupons yet.')}
						</div>
					) : (
						<div className="divide-y divide-gray-100">
							{filtered.map((c) => (
								<div
									key={c.id}
									className="flex items-center gap-3 p-4 hover:bg-gray-50"
								>
									<div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
										<Percent size={18} />
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2">
											<p className="font-mono font-bold text-gray-900">
												{c.code}
											</p>
											<button
												type="button"
												onClick={() => {
													navigator.clipboard.writeText(c.code);
													addToast({
														type: 'success',
														message: t(
															'admin.coupons.copied',
															'Code copied',
														),
													});
												}}
												className="text-gray-400 hover:text-gray-700"
												title="Copy"
											>
												<Copy size={12} />
											</button>
										</div>
										<p className="text-xs text-gray-500 mt-0.5">
											{c.type === 'percentage'
												? `${c.value}%`
												: `${c.value} ${t('admin.coupons.fixedSuffix', 'off')}`}{' '}
											· {t('admin.coupons.used', 'used')}{' '}
											{c.usage_count}
											{c.usage_limit
												? ` / ${c.usage_limit}`
												: ''}{' '}
											· {t('admin.coupons.minOrder', 'min')}{' '}
											{c.min_order_amount}
										</p>
										<p className="text-[10px] text-gray-400 mt-0.5">
											{c.expires_at
												? `${t('admin.coupons.expires', 'Expires')}: ${c.expires_at.slice(0, 10)}`
												: t('admin.coupons.noExpiry', 'No expiry')}
										</p>
									</div>
									<span
										className={cn(
											'px-2 py-0.5 rounded-full text-xs font-bold',
											c.is_active
												? 'bg-emerald-50 text-emerald-700'
												: 'bg-gray-100 text-gray-500',
										)}
									>
										{c.is_active
											? t('admin.coupons.activeLabel', 'Active')
											: t('admin.coupons.inactive', 'Inactive')}
									</span>
									<button
										type="button"
										onClick={() => {
											setEditing(c);
											setCreating(false);
											setDraft({ ...c });
										}}
										className="text-xs font-bold text-amber-700 hover:underline"
									>
										{t('common.edit', 'Edit')}
									</button>
									<button
										type="button"
										onClick={() => handleDelete(c)}
										className="text-red-500 hover:text-red-700 p-1 rounded"
										title={t('common.delete', 'Delete')}
									>
										<Trash2 size={14} />
									</button>
								</div>
							))}
						</div>
					)}
				</div>
			</div>

			{(editing || creating) && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
					<div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
						<div className="flex items-center justify-between mb-4">
							<h3 className="text-lg font-bold">
								{editing
									? t('admin.coupons.editTitle', 'Edit coupon')
									: t('admin.coupons.newTitle', 'New coupon')}
							</h3>
							<button
								type="button"
								onClick={() => {
									setEditing(null);
									setCreating(false);
									setDraft({});
								}}
								className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
							>
								<X size={16} />
							</button>
						</div>
						<div className="space-y-3">
							<Field
								label={t('admin.coupons.code', 'Code')}
								value={String(draft.code ?? '')}
								onChange={(v) =>
									setDraft({
										...draft,
										code: v.toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
									})
								}
								placeholder="WELCOME10"
								required
							/>
							<div className="grid grid-cols-2 gap-3">
								<Select
									label={t('admin.coupons.type', 'Type')}
									value={String(draft.type ?? 'percentage')}
									options={[
										{ value: 'percentage', label: '% Percentage' },
										{ value: 'fixed', label: 'ر.ي Fixed amount' },
									]}
									onChange={(v) =>
										setDraft({ ...draft, type: v as 'percentage' | 'fixed' })
									}
								/>
								<Field
									label={t('admin.coupons.value', 'Value')}
									type="number"
									value={String(draft.value ?? 0)}
									onChange={(v) =>
										setDraft({ ...draft, value: Number(v) || 0 })
									}
								/>
							</div>
							<div className="grid grid-cols-2 gap-3">
								<Field
									label={t('admin.coupons.minOrder', 'Min order')}
									type="number"
									value={String(draft.min_order_amount ?? 0)}
									onChange={(v) =>
										setDraft({ ...draft, min_order_amount: Number(v) || 0 })
									}
								/>
								<Field
									label={t('admin.coupons.usageLimit', 'Usage limit')}
									type="number"
									value={String(draft.usage_limit ?? '')}
									onChange={(v) =>
										setDraft({
											...draft,
											usage_limit: v ? Number(v) : undefined,
										})
									}
								/>
							</div>
							<Field
								label={t('admin.coupons.expires', 'Expires at (ISO datetime)')}
								value={String(draft.expires_at ?? '')}
								onChange={(v) =>
									setDraft({ ...draft, expires_at: v || undefined })
								}
								placeholder="2026-12-31T23:59:59Z"
							/>
							<label className="block">
								<span className="block text-xs font-bold text-gray-700 mb-1.5">
									{t('admin.coupons.description', 'Description')}
								</span>
								<textarea
									value={String(draft.description ?? '')}
									onChange={(e) =>
										setDraft({ ...draft, description: e.target.value })
									}
									rows={2}
									className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-[#D4A853] focus:ring-1 focus:ring-[#D4A853] outline-none resize-none"
								/>
							</label>
							<label className="flex items-center gap-2 text-sm">
								<input
									type="checkbox"
									checked={Boolean(draft.is_active)}
									onChange={(e) =>
										setDraft({ ...draft, is_active: e.target.checked })
									}
								/>
								{t('admin.coupons.activeLabel', 'Active')}
							</label>
						</div>
						<div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
							<button
								type="button"
								onClick={() => {
									setEditing(null);
									setCreating(false);
									setDraft({});
								}}
								className="px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-100"
							>
								{t('common.cancel', 'Cancel')}
							</button>
							<button
								type="button"
								onClick={handleSave}
								disabled={saving || !draft.code}
								className="px-5 py-2 rounded-lg bg-[#D4A853] hover:bg-[#B8923F] text-white text-sm font-bold disabled:opacity-40 inline-flex items-center gap-2"
							>
								{saving ? (
									<Loader2 size={14} className="animate-spin" />
								) : (
									<Save size={14} />
								)}
								{t('common.save', 'Save')}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

function Stat({
	label,
	value,
	tone,
}: {
	label: string;
	value: string;
	tone: 'amber' | 'emerald' | 'blue';
}) {
	const tones = {
		amber: 'text-amber-600 bg-amber-50',
		emerald: 'text-emerald-600 bg-emerald-50',
		blue: 'text-blue-600 bg-blue-50',
	};
	return (
		<div className="bg-white rounded-2xl border border-gray-200 p-4">
			<div
				className={cn(
					'inline-flex items-center justify-center text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-1',
					tones[tone],
				)}
			>
				{label}
			</div>
			<p className="text-2xl font-extrabold text-gray-900">{value}</p>
		</div>
	);
}

function Field({
	label,
	value,
	onChange,
	type = 'text',
	required,
	placeholder,
}: {
	label: string;
	value: string;
	onChange: (v: string) => void;
	type?: string;
	required?: boolean;
	placeholder?: string;
}) {
	return (
		<label className="block">
			<span className="block text-xs font-bold text-gray-700 mb-1.5">
				{label}
				{required && <span className="text-red-500 ms-1">*</span>}
			</span>
			<input
				type={type}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:border-[#D4A853] focus:ring-1 focus:ring-[#D4A853] outline-none"
			/>
		</label>
	);
}

function Select({
	label,
	value,
	options,
	onChange,
}: {
	label: string;
	value: string;
	options: { value: string; label: string }[];
	onChange: (v: string) => void;
}) {
	return (
		<label className="block">
			<span className="block text-xs font-bold text-gray-700 mb-1.5">{label}</span>
			<select
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:border-[#D4A853] focus:ring-1 focus:ring-[#D4A853] outline-none bg-white"
			>
				{options.map((o) => (
					<option key={o.value} value={o.value}>
						{o.label}
					</option>
				))}
			</select>
		</label>
	);
}
