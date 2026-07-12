import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
	ArrowRight,
	Camera,
	CheckCircle2,
	Eye,
	EyeOff,
	Lock,
	MapPin,
	Mail,
	Phone,
	Save,
	Shield,
	ShieldCheck,
	User as UserIcon,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { apiRequest, ApiError } from '@/lib/api/client';
import { cn } from '@/lib/utils';

type ProfileForm = {
	name: string;
	email: string;
	phone: string;
	language: 'ar' | 'en' | 'zh';
};

type PasswordForm = {
	current: string;
	next: string;
	confirm: string;
};

function calcCompletion(p: ProfileForm, hasAvatar: boolean): number {
	const checks: Array<{ ok: boolean }> = [
		{ ok: hasAvatar },
		{ ok: Boolean(p.name && p.name.length >= 2) },
		{ ok: Boolean(p.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email)) },
		{ ok: Boolean(p.phone && p.phone.replace(/\D/g, '').length >= 7) },
		{ ok: Boolean(p.language) },
	];
	const done = checks.filter((c) => c.ok).length;
	return Math.round((done / checks.length) * 100);
}

export default function Profile() {
	const { t, i18n } = useTranslation();
	const navigate = useNavigate();
	const { state, addToast } = useApp();
	const user = state.user;
	const isRTL = i18n.language === 'ar';

	const [form, setForm] = useState<ProfileForm>({
		name: user?.name ?? '',
		email: user?.email ?? '',
		phone: (user as { phone?: string } | undefined)?.phone ?? '',
		language: ((user as { language?: string } | undefined)?.language as 'ar' | 'en' | 'zh') ?? (i18n.language as 'ar' | 'en' | 'zh'),
	});
	const [savingProfile, setSavingProfile] = useState(false);

	const [pw, setPw] = useState<PasswordForm>({
		current: '',
		next: '',
		confirm: '',
	});
	const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });
	const [changingPw, setChangingPw] = useState(false);
	const [pwErrors, setPwErrors] = useState<string[]>([]);
	const profileAbortRef = useRef<AbortController | null>(null);

	useEffect(() => {
		return () => profileAbortRef.current?.abort();
	}, []);

	const completion = calcCompletion(form, Boolean(user?.avatar));

	const onProfileSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setSavingProfile(true);
		profileAbortRef.current?.abort();
		profileAbortRef.current = new AbortController();
		try {
			await apiRequest('/api/auth/me', {
				method: 'PATCH',
				body: JSON.stringify({
					name: form.name,
					email: form.email,
					phone: form.phone,
					language: form.language,
				}),
				signal: profileAbortRef.current.signal,
			});
			i18n.changeLanguage(form.language);
			addToast({ type: 'success', message: t('customer.profileSaveSuccess', 'Profile saved') });
		} catch (err) {
			if (err instanceof ApiError) {
				addToast({
					type: 'error',
					message: err.message || t('common.error'),
				});
			}
		} finally {
			setSavingProfile(false);
		}
	};

	const onPasswordSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const errors: string[] = [];
		if (!pw.current) errors.push(t('customer.currentPassword') + ' ' + t('common.required').toLowerCase());
		if (!pw.next || pw.next.length < 8) errors.push('≥ 8 ' + t('customer.newPassword').toLowerCase());
		if (pw.next !== pw.confirm) errors.push(t('customer.passwordMismatch'));
		setPwErrors(errors);
		if (errors.length > 0) return;
		setChangingPw(true);
		try {
			await apiRequest('/api/auth/change-password', {
				method: 'POST',
				body: JSON.stringify({ current: pw.current, next: pw.next }),
			});
			setPw({ current: '', next: '', confirm: '' });
			addToast({ type: 'success', message: t('customer.passwordChanged', 'Password changed') });
		} catch (err) {
			if (err instanceof ApiError) {
				addToast({
					type: 'error',
					message: err.message || t('common.error'),
				});
			}
		} finally {
			setChangingPw(false);
		}
	};

	return (
		<div className="min-h-screen bg-[#FAFAF7]" dir={isRTL ? 'rtl' : 'ltr'}>
			{/* Header */}
			<header className="sticky top-0 z-30 bg-white border-b border-gray-200">
				<div className="max-w-4xl mx-auto px-4 lg:px-6 h-16 flex items-center gap-3">
					<button
						onClick={() => navigate(-1)}
						className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100"
					>
						<ArrowRight className={cn('w-5 h-5', isRTL ? 'rotate-180' : '')} />
					</button>
					<div>
						<p className="text-[10px] uppercase tracking-widest text-[#D4A853] font-bold">
							{t('customer.account')}
						</p>
						<p className="text-sm font-extrabold text-gray-900">
							{t('customer.profile')}
						</p>
					</div>
				</div>
			</header>

			<div className="max-w-4xl mx-auto px-4 lg:px-6 py-6 space-y-6">
				{/* Hero */}
				<div className="rounded-2xl bg-gradient-to-br from-[#1A1612] via-[#2A2420] to-[#1A1612] text-white p-6 relative overflow-hidden">
					<div className="absolute inset-0 opacity-10">
						<div className="absolute -top-12 -end-12 w-64 h-64 rounded-full bg-[#D4A853] blur-3xl" />
					</div>
					<div className="relative flex flex-wrap items-center gap-5">
						<div className="relative">
							{user?.avatar ? (
								<img
									src={user.avatar}
									alt={user.name ?? 'avatar'}
									className="w-20 h-20 rounded-full object-cover ring-4 ring-white/20"
								/>
							) : (
								<div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#D4A853] to-[#8B6F2F] flex items-center justify-center text-white font-extrabold text-2xl ring-4 ring-white/20">
									{(user?.name ?? '?').charAt(0).toUpperCase()}
								</div>
							)}
							<button
								className="absolute -bottom-1 -end-1 w-8 h-8 rounded-full bg-[#D4A853] hover:bg-[#B8923F] flex items-center justify-center shadow-lg transition-colors"
								title={t('customer.addAvatar')}
							>
								<Camera size={14} />
							</button>
						</div>
						<div className="flex-1 min-w-0">
							<p className="text-[10px] uppercase tracking-widest text-[#D4A853] font-bold">
								{t('customer.profile')}
							</p>
							<h1 className="text-xl font-bold truncate">
								{user?.name ?? t('customer.guest')}
							</h1>
							<p className="text-xs text-white/60 mt-1 truncate">{user?.email}</p>
						</div>
						<div className="text-end">
							<p className="text-[10px] uppercase tracking-widest text-[#D4A853] font-bold">
								{t('customer.profileCompletion')}
							</p>
							<div className="flex items-center gap-2 mt-1">
								<div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
									<div
										className="h-full bg-[#D4A853] transition-all duration-500"
										style={{ width: `${completion}%` }}
									/>
								</div>
								<span className="text-sm font-extrabold">{completion}%</span>
							</div>
						</div>
					</div>
				</div>

				{/* Profile form */}
				<section className="bg-white rounded-2xl border border-gray-200 p-6">
					<h2 className="text-base font-bold text-gray-900 mb-1 flex items-center gap-2">
						<UserIcon size={16} className="text-[#D4A853]" />
						{t('customer.profileSubtitle')}
					</h2>
					<p className="text-xs text-gray-500 mb-6">
						{t('customer.completeProfile')}
					</p>
					<form onSubmit={onProfileSubmit} className="space-y-4">
						<div className="grid sm:grid-cols-2 gap-4">
							<div>
								<label className="block text-xs font-bold text-gray-700 mb-1.5">
									{t('common.name')} <span className="text-red-500">*</span>
								</label>
								<div className="relative">
									<UserIcon
										size={14}
										className="absolute top-1/2 -translate-y-1/2 start-3 text-gray-400"
									/>
									<input
										type="text"
										value={form.name}
										onChange={(e) => setForm({ ...form, name: e.target.value })}
										className="w-full h-10 ps-9 pe-3 border border-gray-300 rounded-lg text-sm focus:border-[#D4A853] focus:ring-1 focus:ring-[#D4A853] outline-none"
										required
									/>
								</div>
							</div>
							<div>
								<label className="block text-xs font-bold text-gray-700 mb-1.5">
									{t('common.email')} <span className="text-red-500">*</span>
								</label>
								<div className="relative">
									<Mail
										size={14}
										className="absolute top-1/2 -translate-y-1/2 start-3 text-gray-400"
									/>
									<input
										type="email"
										value={form.email}
										onChange={(e) => setForm({ ...form, email: e.target.value })}
										className="w-full h-10 ps-9 pe-3 border border-gray-300 rounded-lg text-sm focus:border-[#D4A853] focus:ring-1 focus:ring-[#D4A853] outline-none"
										required
									/>
								</div>
							</div>
							<div>
								<label className="block text-xs font-bold text-gray-700 mb-1.5">
									{t('common.phone')}
								</label>
								<div className="relative">
									<Phone
										size={14}
										className="absolute top-1/2 -translate-y-1/2 start-3 text-gray-400"
									/>
									<input
										type="tel"
										value={form.phone}
										onChange={(e) => setForm({ ...form, phone: e.target.value })}
										placeholder="+967 7XX XXX XXX"
										className="w-full h-10 ps-9 pe-3 border border-gray-300 rounded-lg text-sm focus:border-[#D4A853] focus:ring-1 focus:ring-[#D4A853] outline-none placeholder:text-gray-400"
									/>
								</div>
							</div>
							<div>
								<label className="block text-xs font-bold text-gray-700 mb-1.5">
									{t('common.language')}
								</label>
								<select
									value={form.language}
									onChange={(e) =>
										setForm({
											...form,
											language: e.target.value as 'ar' | 'en' | 'zh',
										})
									}
									className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:border-[#D4A853] focus:ring-1 focus:ring-[#D4A853] outline-none bg-white"
								>
									<option value="ar">العربية</option>
									<option value="en">English</option>
									<option value="zh">中文</option>
								</select>
							</div>
						</div>
						<div className="flex justify-end pt-2">
							<button
								type="submit"
								disabled={savingProfile}
								className="px-5 py-2 rounded-full bg-[#D4A853] hover:bg-[#B8923F] text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
							>
								<Save size={14} />
								{savingProfile ? t('common.loading') : t('common.save')}
							</button>
						</div>
					</form>
				</section>

				{/* Security */}
				<section className="bg-white rounded-2xl border border-gray-200 p-6">
					<h2 className="text-base font-bold text-gray-900 mb-1 flex items-center gap-2">
						<Shield size={16} className="text-[#D4A853]" />
						{t('customer.security')}
					</h2>
					<p className="text-xs text-gray-500 mb-6">
						{t('customer.changePassword')}
					</p>
					<form onSubmit={onPasswordSubmit} className="space-y-4">
						<div>
							<label className="block text-xs font-bold text-gray-700 mb-1.5">
								{t('customer.currentPassword')}
							</label>
							<div className="relative">
								<Lock
									size={14}
									className="absolute top-1/2 -translate-y-1/2 start-3 text-gray-400"
								/>
								<input
									type={showPw.current ? 'text' : 'password'}
									value={pw.current}
									onChange={(e) => setPw({ ...pw, current: e.target.value })}
									className="w-full h-10 ps-9 pe-10 border border-gray-300 rounded-lg text-sm focus:border-[#D4A853] focus:ring-1 focus:ring-[#D4A853] outline-none"
								/>
								<button
									type="button"
									onClick={() => setShowPw({ ...showPw, current: !showPw.current })}
									className="absolute top-1/2 -translate-y-1/2 end-3 text-gray-400 hover:text-gray-600"
								>
									{showPw.current ? <EyeOff size={14} /> : <Eye size={14} />}
								</button>
							</div>
						</div>
						<div className="grid sm:grid-cols-2 gap-4">
							<div>
								<label className="block text-xs font-bold text-gray-700 mb-1.5">
									{t('customer.newPassword')}
								</label>
								<div className="relative">
									<Lock
										size={14}
										className="absolute top-1/2 -translate-y-1/2 start-3 text-gray-400"
									/>
									<input
										type={showPw.next ? 'text' : 'password'}
										value={pw.next}
										onChange={(e) => setPw({ ...pw, next: e.target.value })}
										className="w-full h-10 ps-9 pe-10 border border-gray-300 rounded-lg text-sm focus:border-[#D4A853] focus:ring-1 focus:ring-[#D4A853] outline-none"
									/>
									<button
										type="button"
										onClick={() => setShowPw({ ...showPw, next: !showPw.next })}
										className="absolute top-1/2 -translate-y-1/2 end-3 text-gray-400 hover:text-gray-600"
									>
										{showPw.next ? <EyeOff size={14} /> : <Eye size={14} />}
									</button>
								</div>
							</div>
							<div>
								<label className="block text-xs font-bold text-gray-700 mb-1.5">
									{t('customer.confirmPassword')}
								</label>
								<div className="relative">
									<Lock
										size={14}
										className="absolute top-1/2 -translate-y-1/2 start-3 text-gray-400"
									/>
									<input
										type={showPw.confirm ? 'text' : 'password'}
										value={pw.confirm}
										onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
										className="w-full h-10 ps-9 pe-10 border border-gray-300 rounded-lg text-sm focus:border-[#D4A853] focus:ring-1 focus:ring-[#D4A853] outline-none"
									/>
									<button
										type="button"
										onClick={() => setShowPw({ ...showPw, confirm: !showPw.confirm })}
										className="absolute top-1/2 -translate-y-1/2 end-3 text-gray-400 hover:text-gray-600"
									>
										{showPw.confirm ? <EyeOff size={14} /> : <Eye size={14} />}
									</button>
								</div>
							</div>
						</div>
						{pwErrors.length > 0 && (
							<ul className="text-xs text-red-600 space-y-1 bg-red-50 border border-red-200 rounded-lg p-3">
								{pwErrors.map((err, i) => (
									<li key={i}>• {err}</li>
								))}
							</ul>
						)}
						<div className="flex justify-end pt-2">
							<button
								type="submit"
								disabled={changingPw}
								className="px-5 py-2 rounded-full bg-gray-900 hover:bg-gray-800 text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
							>
								<ShieldCheck size={14} />
								{changingPw ? t('common.loading') : t('customer.changePassword')}
							</button>
						</div>
					</form>
				</section>

				{/* Quick links */}
				<section className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
					{[
						{
							icon: Shield,
							label: t('customer.enable2FA'),
							subtitle: 'TOTP · backup codes',
							path: '/auth/2fa',
						},
						{
							icon: MapPin,
							label: t('customer.addresses'),
							subtitle: t('customer.savedAddresses'),
							path: '/customer/addresses',
						},
						{
							icon: CheckCircle2,
							label: t('customer.help'),
							subtitle: 'FAQ · contact support',
							path: '/customer/help',
						},
					].map((item) => (
						<Link
							key={item.path}
							to={item.path}
							className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors group"
						>
							<div className="w-10 h-10 rounded-lg bg-gray-100 group-hover:bg-[#D4A853]/10 flex items-center justify-center shrink-0">
								<item.icon
									size={18}
									className="text-gray-500 group-hover:text-[#D4A853]"
								/>
							</div>
							<div className="flex-1 min-w-0">
								<p className="text-sm font-semibold text-gray-900">{item.label}</p>
								<p className="text-xs text-gray-500 mt-0.5">{item.subtitle}</p>
							</div>
							<ArrowRight
								size={16}
								className={cn(
									'text-gray-400 group-hover:text-[#D4A853] transition-colors',
									isRTL ? 'rotate-180' : '',
								)}
							/>
						</Link>
					))}
				</section>
			</div>
		</div>
	);
}
