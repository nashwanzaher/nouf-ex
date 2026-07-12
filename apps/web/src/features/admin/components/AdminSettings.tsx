import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	AlertCircle,
	CheckCircle2,
	CreditCard,
	Globe,
	Loader2,
	Save,
	Settings as SettingsIcon,
	Shield,
	Truck,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { cn } from '@/lib/utils';
import {
	getAdminSettings,
	patchAdminSetting,
	type AdminSetting,
} from '@/features/admin/api/admin';

interface SettingDef {
	key: string;
	labelKey: string;
	descriptionKey: string;
	icon: typeof SettingsIcon;
	tone: 'amber' | 'blue' | 'emerald' | 'purple';
	type?: 'number' | 'text';
}

const SETTINGS: SettingDef[] = [
	{
		key: 'DEFAULT_CURRENCY',
		labelKey: 'admin.settings.currency',
		descriptionKey: 'admin.settings.currencyDesc',
		icon: CreditCard,
		tone: 'amber',
	},
	{
		key: 'FLAT_SHIPPING_COST',
		labelKey: 'admin.settings.flatShipping',
		descriptionKey: 'admin.settings.flatShippingDesc',
		icon: Truck,
		tone: 'blue',
		type: 'number',
	},
	{
		key: 'FREE_SHIPPING_THRESHOLD',
		labelKey: 'admin.settings.freeShipping',
		descriptionKey: 'admin.settings.freeShippingDesc',
		icon: Truck,
		tone: 'emerald',
		type: 'number',
	},
	{
		key: 'SUPPORT_EMAIL',
		labelKey: 'admin.settings.supportEmail',
		descriptionKey: 'admin.settings.supportEmailDesc',
		icon: Globe,
		tone: 'purple',
		type: 'text',
	},
	{
		key: 'ENABLE_2FA_REQUIRED',
		labelKey: 'admin.settings.enforce2FA',
		descriptionKey: 'admin.settings.enforce2FADesc',
		icon: Shield,
		tone: 'amber',
	},
];

export default function AdminSettings() {
	const { t, i18n } = useTranslation();
	const isRTL = i18n.language === 'ar';
	const { addToast } = useApp();
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState<string | null>(null);
	const [settings, setSettings] = useState<Record<string, string>>({});
	const [edits, setEdits] = useState<Record<string, string>>({});

	useEffect(() => {
		let alive = true;
		getAdminSettings()
			.then((res) => {
				if (!alive) return;
				const map: Record<string, string> = {};
				(res.settings as AdminSetting[]).forEach((s) => (map[s.key] = s.value));
				setSettings(map);
			})
			.catch((e: unknown) => {
				if (alive)
					addToast({
						type: 'error',
						message: e instanceof Error ? e.message : String(e),
					});
			})
			.finally(() => alive && setLoading(false));
		return () => {
			alive = false;
		};
	}, [addToast]);

	const handleSave = async (key: string) => {
		const newVal = edits[key];
		if (newVal === undefined) return;
		setSaving(key);
		try {
			await patchAdminSetting(key, newVal);
			setSettings((p) => ({ ...p, [key]: newVal }));
			setEdits((p) => {
				const c = { ...p };
				delete c[key];
				return c;
			});
			addToast({
				type: 'success',
				message: `${t('common.saved', 'Saved')} — ${key}`,
			});
		} catch (e: unknown) {
			addToast({
				type: 'error',
				message: e instanceof Error ? e.message : String(e),
			});
		} finally {
			setSaving(null);
		}
	};

	const tones: Record<string, string> = {
		amber: 'bg-amber-50 text-amber-700',
		blue: 'bg-blue-50 text-blue-700',
		emerald: 'bg-emerald-50 text-emerald-700',
		purple: 'bg-purple-50 text-purple-700',
	};

	return (
		<div className="min-h-screen bg-[#FAFAF7]" dir={isRTL ? 'rtl' : 'ltr'}>
			<div className="max-w-4xl mx-auto px-4 lg:px-6 py-6 space-y-6">
				<div className="rounded-2xl bg-gradient-to-br from-[#1A1612] via-[#2A2420] to-[#1A1612] text-white p-6 lg:p-8 relative overflow-hidden">
					<div className="absolute inset-0 opacity-10">
						<div className="absolute -top-12 -end-12 w-64 h-64 rounded-full bg-[#D4A853] blur-3xl" />
					</div>
					<div className="relative flex items-center gap-4">
						<div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center">
							<SettingsIcon size={26} className="text-[#D4A853]" />
						</div>
						<div>
							<p className="text-xs uppercase tracking-widest text-[#D4A853] font-bold">
								{t('admin.navSettings', 'Settings')}
							</p>
							<h1 className="text-xl font-bold mt-1">
								{t('admin.settings.title', 'Platform Settings')}
							</h1>
							<p className="text-sm text-white/60 mt-1">
								{t(
									'admin.settings.subtitle',
									'Configure global platform options. Changes apply immediately.',
								)}
							</p>
						</div>
					</div>
				</div>

				{loading ? (
					<div className="bg-white rounded-2xl border border-gray-200 p-12 flex items-center justify-center">
						<Loader2 className="w-6 h-6 animate-spin text-gray-400" />
					</div>
				) : (
					<div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
						{SETTINGS.map((def) => {
							const current = settings[def.key] ?? '—';
							const editing = edits[def.key] !== undefined;
							return (
								<div
									key={def.key}
									className="p-5 flex flex-col sm:flex-row sm:items-center gap-4"
								>
									<div
										className={cn(
											'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
											tones[def.tone],
										)}
									>
										<def.icon size={20} />
									</div>
									<div className="flex-1 min-w-0">
										<p className="text-sm font-bold text-gray-900">
											{t(def.labelKey, def.key)}
										</p>
										<p className="text-xs text-gray-500 mt-0.5">
											{t(def.descriptionKey, '')}
										</p>
										<p className="text-[10px] font-mono text-gray-400 mt-1">
											{def.key} = {current}
										</p>
									</div>
									<div className="flex items-center gap-2 shrink-0">
										<input
											type={def.type === 'number' ? 'number' : 'text'}
											value={edits[def.key] ?? current}
											onChange={(e) =>
												setEdits((p) => ({
													...p,
													[def.key]: e.target.value,
												}))
											}
											className="h-9 px-3 border border-gray-300 rounded-lg text-sm focus:border-[#D4A853] focus:ring-1 focus:ring-[#D4A853] outline-none w-32"
										/>
										<button
											type="button"
											onClick={() => handleSave(def.key)}
											disabled={!editing || saving === def.key}
											className="h-9 px-4 rounded-lg bg-[#D4A853] hover:bg-[#B8923F] text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
										>
											{saving === def.key ? (
												<Loader2 size={14} className="animate-spin" />
											) : (
												<Save size={14} />
											)}
											{t('common.save', 'Save')}
										</button>
									</div>
								</div>
							);
						})}
						{Object.keys(settings).filter((k) => !SETTINGS.some((s) => s.key === k)).length >
							0 && (
							<div className="p-5 bg-gray-50 text-sm text-gray-500 flex items-center gap-2">
								<CheckCircle2 size={16} className="text-emerald-500" />
								{t('admin.settings.allConfigured', 'All core settings are configured.')}
							</div>
						)}
					</div>
				)}

				{Object.keys(settings).filter((k) => !SETTINGS.some((s) => s.key === k)).length >
					0 && (
					<section className="bg-white rounded-2xl border border-gray-200 p-6">
						<h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
							<AlertCircle size={16} className="text-amber-500" />
							{t('admin.settings.otherSettings', 'Other configured settings')}
						</h2>
						<div className="space-y-2">
							{Object.entries(settings)
								.filter(([k]) => !SETTINGS.some((s) => s.key === k))
								.map(([k, v]) => (
									<div
										key={k}
										className="flex items-center justify-between p-2 rounded-lg bg-gray-50"
									>
										<code className="text-xs font-mono text-gray-700">{k}</code>
										<code className="text-xs font-mono text-gray-900">{v}</code>
									</div>
								))}
						</div>
					</section>
				)}
			</div>
		</div>
	);
}
