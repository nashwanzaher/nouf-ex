import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	ChevronDown,
	ChevronRight,
	FolderTree,
	Loader2,
	Plus,
	Save,
	Tag,
	Trash2,
	X,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { cn } from '@/lib/utils';
import {
	createAdminCategory,
	deleteAdminCategory,
	getAdminCategories,
	patchAdminCategory,
	type AdminCategory,
} from '@/features/admin/api/admin';

export default function AdminCategories() {
	const { t } = useTranslation();
	const { addToast } = useApp();
	const [items, setItems] = useState<AdminCategory[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState('');
	const [editing, setEditing] = useState<AdminCategory | null>(null);
	const [creating, setCreating] = useState(false);
	const [draft, setDraft] = useState<Partial<AdminCategory>>({});
	const [saving, setSaving] = useState(false);

	const reload = async () => {
		setLoading(true);
		try {
			const res = await getAdminCategories();
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

	if (items.length === 0 && !loading) reload();

	const filtered = useMemo(
		() =>
			items.filter((c) =>
				search
					? `${c.name_ar} ${c.name_en ?? ''} ${c.slug}`
							.toLowerCase()
							.includes(search.toLowerCase())
					: true,
			),
		[items, search],
	);

	const handleSave = async () => {
		setSaving(true);
		try {
			if (editing) {
				await patchAdminCategory(editing.id, draft);
				addToast({ type: 'success', message: t('common.saved', 'Saved') });
			} else {
				await createAdminCategory(draft);
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

	const handleDelete = async (c: AdminCategory) => {
		if (
			!confirm(
				t(
					'admin.categories.confirmDeactivate',
					'Deactivate this category? Existing products will keep it.',
				),
			)
		)
			return;
		try {
			await deleteAdminCategory(c.id);
			addToast({ type: 'success', message: t('common.saved', 'Deactivated') });
			reload();
		} catch (e: unknown) {
			addToast({
				type: 'error',
				message: e instanceof Error ? e.message : String(e),
			});
		}
	};

	const tree = useMemo(() => {
		const map = new Map<number, AdminCategory & { children: AdminCategory[] }>();
		items.forEach((c) => map.set(c.id, { ...c, children: [] }));
		const roots: (AdminCategory & { children: AdminCategory[] })[] = [];
		map.forEach((c) => {
			if (c.parent_id && map.has(c.parent_id)) {
				map.get(c.parent_id)!.children.push(c);
			} else {
				roots.push(c);
			}
		});
		return roots;
	}, [items]);

	const Row = ({
		c,
		depth,
	}: {
		c: AdminCategory & { children: AdminCategory[] };
		depth: number;
	}) => (
		<>
			<div
				className={cn(
					'flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors border-b border-gray-100',
				)}
				style={{ paddingInlineStart: 12 + depth * 24 }}
			>
				{c.children.length > 0 ? (
					<ChevronDown size={14} className="text-gray-400" />
				) : (
					<ChevronRight size={14} className="text-gray-300" />
				)}
				<div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 text-base">
					{c.icon || <Tag size={14} />}
				</div>
				<div className="flex-1 min-w-0">
					<p className="text-sm font-semibold text-gray-900 truncate">
						{c.name_ar}{' '}
						{c.name_en && (
							<span className="text-gray-500 font-normal">/ {c.name_en}</span>
						)}
					</p>
					<p className="text-[10px] font-mono text-gray-400">/{c.slug}</p>
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
						? t('admin.categories.active', 'Active')
						: t('admin.categories.inactive', 'Inactive')}
				</span>
				<button
					type="button"
					onClick={() => {
						setEditing(c);
						setCreating(false);
						setDraft({
							parent_id: c.parent_id,
							name_ar: c.name_ar,
							name_en: c.name_en ?? '',
							name_zh: c.name_zh ?? '',
							slug: c.slug,
							icon: c.icon ?? '',
							image: c.image ?? '',
							sort_order: c.sort_order,
							is_active: c.is_active,
						});
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
			{c.children.map((ch) => (
				<Row key={ch.id} c={ch as AdminCategory & { children: AdminCategory[] }} depth={depth + 1} />
			))}
		</>
	);

	return (
		<div className="min-h-screen bg-[#FAFAF7]">
			<div className="max-w-5xl mx-auto px-4 lg:px-6 py-6 space-y-6">
				<div className="rounded-2xl bg-gradient-to-br from-[#1A1612] via-[#2A2420] to-[#1A1612] text-white p-6 lg:p-8 relative overflow-hidden">
					<div className="absolute inset-0 opacity-10">
						<div className="absolute -top-12 -end-12 w-64 h-64 rounded-full bg-[#D4A853] blur-3xl" />
					</div>
					<div className="relative flex items-center justify-between gap-4">
						<div className="flex items-center gap-4">
							<div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center">
								<FolderTree size={26} className="text-[#D4A853]" />
							</div>
							<div>
								<p className="text-xs uppercase tracking-widest text-[#D4A853] font-bold">
									{t('admin.navCategories', 'Catalog')}
								</p>
								<h1 className="text-xl font-bold mt-1">
									{t('admin.categories.title', 'Categories')}
								</h1>
								<p className="text-sm text-white/60 mt-1">
									{items.length}{' '}
									{t('admin.categories.total', 'total')} ·{' '}
									{items.filter((c) => c.is_active).length}{' '}
									{t('admin.categories.active', 'active')}
								</p>
							</div>
						</div>
						<button
							type="button"
							onClick={() => {
								setCreating(true);
								setEditing(null);
								setDraft({ is_active: true, sort_order: 0 });
							}}
							className="px-4 py-2 rounded-full bg-[#D4A853] hover:bg-[#B8923F] text-sm font-bold inline-flex items-center gap-2"
						>
							<Plus size={14} />
							{t('admin.categories.new', 'New Category')}
						</button>
					</div>
				</div>

				<div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
					<div className="p-4 border-b border-gray-100">
						<input
							type="text"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder={t('common.search', 'Search...')}
							className="w-full h-10 px-4 border border-gray-300 rounded-lg text-sm focus:border-[#D4A853] focus:ring-1 focus:ring-[#D4A853] outline-none"
						/>
					</div>

					{loading ? (
						<div className="p-12 flex items-center justify-center">
							<Loader2 className="w-6 h-6 animate-spin text-gray-400" />
						</div>
					) : filtered.length === 0 ? (
						<div className="p-12 text-center text-sm text-gray-500">
							{t('admin.categories.empty', 'No categories yet.')}
						</div>
					) : (
						<div>
							{tree
								.filter((c) => filtered.includes(c))
								.map((c) => (
									<Row
										key={c.id}
										c={c as AdminCategory & { children: AdminCategory[] }}
										depth={0}
									/>
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
									? t('admin.categories.editTitle', 'Edit category')
									: t('admin.categories.newTitle', 'New category')}
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
								label={t('admin.categories.nameAr', 'Name (Arabic)')}
								value={String(draft.name_ar ?? '')}
								onChange={(v) => setDraft({ ...draft, name_ar: v })}
								required
							/>
							<Field
								label={t('admin.categories.nameEn', 'Name (English)')}
								value={String(draft.name_en ?? '')}
								onChange={(v) => setDraft({ ...draft, name_en: v })}
							/>
							<Field
								label={t('admin.categories.nameZh', 'Name (Chinese)')}
								value={String(draft.name_zh ?? '')}
								onChange={(v) => setDraft({ ...draft, name_zh: v })}
							/>
							<Field
								label={t('admin.categories.slug', 'Slug (kebab-case)')}
								value={String(draft.slug ?? '')}
								onChange={(v) => setDraft({ ...draft, slug: v })}
								required
							/>
							<Field
								label={t('admin.categories.icon', 'Icon (emoji or URL)')}
								value={String(draft.icon ?? '')}
								onChange={(v) => setDraft({ ...draft, icon: v })}
							/>
							<div className="grid grid-cols-2 gap-3">
								<Field
									label={t('admin.categories.sortOrder', 'Sort order')}
									type="number"
									value={String(draft.sort_order ?? 0)}
									onChange={(v) =>
										setDraft({ ...draft, sort_order: Number(v) || 0 })
									}
								/>
								<label className="block text-xs font-bold text-gray-700 self-end pb-2">
									<input
										type="checkbox"
										checked={Boolean(draft.is_active)}
										onChange={(e) =>
											setDraft({ ...draft, is_active: e.target.checked })
										}
										className="me-2"
									/>
									{t('admin.categories.active', 'Active')}
								</label>
							</div>
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
								disabled={saving || !draft.name_ar || !draft.slug}
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

function Field({
	label,
	value,
	onChange,
	type = 'text',
	required,
}: {
	label: string;
	value: string;
	onChange: (v: string) => void;
	type?: string;
	required?: boolean;
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
				className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:border-[#D4A853] focus:ring-1 focus:ring-[#D4A853] outline-none"
			/>
		</label>
	);
}
