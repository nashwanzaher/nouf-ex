import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
	AlertCircle,
	ArrowRight,
	ArrowLeft,
	Check,
	Eye,
	EyeOff,
	Loader2,
	LogIn,
	Mail,
	ShieldCheck,
	Sparkles,
	Store,
	ShoppingBag,
	User,
	UserPlus,
} from 'lucide-react';
// NOTE: `Lock` is intentionally inlined as an SVG below so we don't
// import the lucide-react default export (its typings don't satisfy
// the strict JSX component type that the Vite + react-jsx setup
// expects after the React 19 upgrade).
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AppContext';
import { register as apiRegister, ApiError } from '@/lib/api';
import { detectIdentifier } from './Login';
import styles from './Login.module.css';

// ── Password strength meter (Amazon / NIST-aligned) ────────────────────
// Returns a 0-4 score and a key used to colour the meter bar.
// Aligned with the backend `evaluatePasswordStrength()` rules so the UI
// meter and the backend validation agree.
type StrengthKey = 'empty' | 'weak' | 'medium' | 'good' | 'strong' | 'excellent';
function evaluateStrength(p: string): { score: number; key: StrengthKey } {
	if (!p) return { score: 0, key: 'empty' };
	let score = 0;
	if (p.length >= 8) score++;
	if (p.length >= 12) score++;
	if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
	if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) score++;
	if (p.length >= 14) score++;
	const key: StrengthKey = (() => {
		if (score <= 0) return 'weak';
		if (score === 1) return 'weak';
		if (score === 2) return 'medium';
		if (score === 3) return 'good';
		if (score === 4) return 'strong';
		return 'excellent';
	})();
	return { score, key };
}

export default function Register() {
	const { t, i18n } = useTranslation();
	const isRTL = i18n.language === 'ar';
	const navigate = useNavigate();
	const { login: authLogin, addToast } = useAuth();

	// ── Account type ─────────────────────────────────────────────────────
	const [accountType, setAccountType] = useState<'buyer' | 'seller'>('buyer');

	// ── Form fields ─────────────────────────────────────────────────────
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [phone, setPhone] = useState('');
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);
	const [terms, setTerms] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [touched, setTouched] = useState<Record<string, boolean>>({});

	// ── Refs for focus management ───────────────────────────────────────
	const nameRef = useRef<HTMLInputElement>(null);
	const emailRef = useRef<HTMLInputElement>(null);
	const phoneRef = useRef<HTMLInputElement>(null);
	const passwordRef = useRef<HTMLInputElement>(null);

	// ── Computed ────────────────────────────────────────────────────────
	const strength = useMemo(() => evaluateStrength(password), [password]);
	const detectedEmailKind = useMemo(() => detectIdentifier(email), [email]);

	// Auto-focus on the name input on mount (Amazon pattern).
	useEffect(() => {
		const t = setTimeout(() => nameRef.current?.focus(), 200);
		return () => clearTimeout(t);
	}, []);

	// ── Live field validation (only shows after blur) ──────────────────
	function validateField(name: keyof typeof errors, value: string): string | undefined {
		if (name === 'name') {
			if (!value.trim()) return t('authCommon.fieldRequired', 'This field is required');
			if (value.trim().length < 2) return t('authCommon.nameMinLength', 'Name must be at least 2 characters');
			if (value.trim().length > 100) return t('authCommon.nameMaxLength', 'Name is too long');
		}
		if (name === 'email') {
			if (!value.trim()) return t('authCommon.fieldRequired', 'This field is required');
			if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))
				return t('authCommon.invalidEmail', 'Invalid email');
		}
		if (name === 'phone' && accountType === 'seller') {
			if (!value.trim()) return t('authCommon.fieldRequired', 'This field is required');
			if (!/^[+\d][\d\s\-()]{5,}$/.test(value.trim()))
				return t('authCommon.invalidPhone', 'Please enter a valid phone number');
		}
		if (name === 'password') {
			if (!value) return t('authCommon.fieldRequired', 'This field is required');
			// Match backend requirements exactly (apps/api/src/lib/validation.ts)
			if (value.length < 10) return t('authCommon.passwordMinLength10', 'Password must be at least 10 characters');
			if (value.length > 128) return t('authCommon.passwordMaxLength', 'Password is too long');
			if (
				!/[a-z]/.test(value) ||
				!/[A-Z]/.test(value) ||
				!/\d/.test(value) ||
				!/[^A-Za-z0-9]/.test(value)
			) {
				return t(
					'authCommon.passwordComplexity',
					'Password must include lowercase, uppercase, digit, and symbol',
				);
			}
		}
		if (name === 'confirmPassword') {
			if (!value) return t('authCommon.fieldRequired', 'This field is required');
			if (value !== password) return t('authCommon.passwordsDoNotMatch', 'Passwords do not match');
		}
		return undefined;
	}

	// ── Final full-form validation (on submit) ───────────────────────
	const validateAll = () => {
		const newErrors: Record<string, string> = {};
		const checks: Array<[keyof typeof errors, string]> = [
			['name', name],
			['email', email],
			...(accountType === 'seller' ? ([['phone', phone]] as Array<[keyof typeof errors, string]>) : []),
			['password', password],
			['confirmPassword', confirmPassword],
		];
		for (const [field, value] of checks) {
			const err = validateField(field, value);
			if (err) newErrors[field] = err;
		}
		if (!terms) newErrors.terms = t('authRegister.termsRequired', 'You must agree to the terms');
		setErrors(newErrors);
		// Mark all touched so the UI shows the errors
		const allTouched: Record<string, boolean> = {};
		for (const [field] of checks) allTouched[field] = true;
		allTouched.terms = true;
		setTouched(allTouched);
		return Object.keys(newErrors).length === 0;
	};

	// ── Submit ─────────────────────────────────────────────────────────
	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!validateAll()) return;
		setIsLoading(true);
		try {
			const result = await apiRegister({
				email: email.trim(),
				password,
				name: name.trim(),
				role: accountType === 'seller' ? 'merchant' : 'customer',
			});
			const authUser = {
				id: String(result.user.id),
				name: result.user.full_name,
				email: result.user.email,
				role:
					(result.user.role as 'customer' | 'merchant' | 'admin' | 'guest') ||
					'customer',
				avatar: result.user.avatar ?? undefined,
			};
			authLogin(authUser);
			addToast({
				message: t('authRegister.accountCreated', 'Account created successfully'),
				type: 'success',
			});
			const destination =
				authUser.role === 'merchant' ? '/seller/onboarding' : '/customer';
			navigate(destination, { replace: true });
		} catch (err) {
			const message =
				err instanceof ApiError
					? err.message
					: t(
							'authRegister.accountCreateError',
							'Could not create the account. Please try again.',
						);
			setErrors({ form: message });
			addToast({ message, type: 'error' });
		} finally {
			setIsLoading(false);
		}
	};

	// ── Field helper that combines touched + error display ────────────
	const fieldError = (field: string) =>
		touched[field] && errors[field] ? errors[field] : undefined;

	// ── Arrow icon for RTL ───────────────────────────────────────────
	const NextIcon = isRTL ? ArrowLeft : ArrowRight;
	const PrevIcon = isRTL ? ArrowRight : ArrowLeft;

	// ── JSX ────────────────────────────────────────────────────────────
	return (
		<div className={`min-h-[100dvh] flex bg-white ${styles.page}`} dir={isRTL ? 'rtl' : 'ltr'}>
			{/* Hero Panel */}
			<aside className={styles.hero} aria-hidden="true">
				<div className={styles.heroPattern} />
				<div className={styles.heroOrb1} />
				<div className={styles.heroOrb2} />
				<div className={styles.heroOrb3} />

				<div className="relative z-10 max-w-md mx-auto text-center px-6">
					<Link to="/" className={styles.brandLink}>
						<div className={styles.brandTile}>
							<Sparkles className="w-10 h-10 text-white" strokeWidth={1.5} />
						</div>
					</Link>

					<h1 className={styles.heroTitle}>
						{t('authRegister.brandName', 'Nouf-ex')}
					</h1>
					<p className={styles.heroSubtitle}>
						{t(
							'authRegister.heroJoin',
							'Join the largest e-commerce platform in the region',
						)}
					</p>

					<div className={styles.statsGrid}>
						<div className={styles.statCard}>
							<Store className={styles.statIconOrange} strokeWidth={1.5} />
							<span className={styles.statLabel}>{t('authCommon.statSellers', '10K+ Sellers')}</span>
						</div>
						<div className={styles.statCard}>
							<ShoppingBag className={styles.statIconBlue} strokeWidth={1.5} />
							<span className={styles.statLabel}>{t('authCommon.statProducts', '500K+ Products')}</span>
						</div>
						<div className={styles.statCard}>
							<ShieldCheck className={styles.statIconGreen} strokeWidth={1.5} />
							<span className={styles.statLabel}>{t('authCommon.statSecurePayment', 'Secure Payment')}</span>
						</div>
					</div>

					<Link to="/" className={styles.ctaPill}>
						{t('authCommon.viewMore', 'View More')}
						<NextIcon className="w-4 h-4" strokeWidth={1.5} />
					</Link>
				</div>
			</aside>

			{/* Form Panel */}
			<main className={styles.formPanel}>
				<div className={styles.formHeader}>
					<Link to="/auth/login" className={styles.headerBtn}>
						<PrevIcon className="w-4 h-4" strokeWidth={1.5} />
						{t('authLogin.signIn', 'Sign in')}
					</Link>
				</div>

				<div className={styles.formCenter}>
					<div className={styles.formCard}>
						<header className={styles.formHeaderSection}>
							<h1 className={styles.formTitle}>
								{t('auth.registerTitle', 'Create Account')}
							</h1>
							<p className={styles.formSubtitle}>
								{t('authRegister.subtitle', 'Create your account and start your journey')}
							</p>
						</header>

						{/* Account Type — segmented control */}
						<div className={styles.methodTabs} role="tablist">
							<button
								role="tab"
								type="button"
								aria-selected={accountType === 'buyer'}
								className={`${styles.methodTab} ${accountType === 'buyer' ? styles.methodTabActive : ''}`}
								onClick={() => setAccountType('buyer')}
							>
								<ShoppingBag className="w-4 h-4" strokeWidth={1.5} />
								<span>{t('authRegister.buyerTab', 'Buyer')}</span>
							</button>
							<button
								role="tab"
								type="button"
								aria-selected={accountType === 'seller'}
								className={`${styles.methodTab} ${accountType === 'seller' ? styles.methodTabActive : ''}`}
								onClick={() => setAccountType('seller')}
							>
								<Store className="w-4 h-4" strokeWidth={1.5} />
								<span>{t('authRegister.sellerTab', 'Seller')}</span>
							</button>
						</div>

						<form onSubmit={handleSubmit} noValidate className={styles.formBody} aria-busy={isLoading}>
							{errors.form && (
								<div role="alert" aria-live="polite" className={styles.formAlert}>
									<AlertCircle className="w-4 h-4 inline me-1.5" strokeWidth={2} />
									{errors.form}
								</div>
							)}

							{/* ── Full Name ──────────────────────────────────────── */}
							<div>
								<Label className={styles.formLabel} htmlFor="name">
									{t('auth.fullName', 'Full name')}
								</Label>
								<div className={styles.inputWrap}>
									<User
										className={`${styles.inputIcon} ${isRTL ? styles.iconR : styles.iconL}`}
										strokeWidth={1.5}
									/>
									<Input
										ref={nameRef}
										id="name"
										type="text"
										autoComplete="name"
										value={name}
										onChange={(e) => {
											setName(e.target.value);
											if (touched.name) {
												const err = validateField('name', e.target.value);
												setErrors((p) => ({ ...p, name: err ?? '' }));
											}
										}}
										onBlur={() => {
											setTouched((p) => ({ ...p, name: true }));
											const err = validateField('name', name);
											setErrors((p) => ({ ...p, name: err ?? '' }));
										}}
										placeholder={t('authRegister.namePlaceholder', 'Ahmed Al-Maqtari')}
										className={`${isRTL ? styles.inputR : styles.inputL} h-12 text-sm rounded ${
											fieldError('name') ? styles.inputError : styles.input
										}`}
									/>
								</div>
								{fieldError('name') && (
									<p className={styles.fieldError}>{fieldError('name')}</p>
								)}
							</div>

							{/* ── Email ──────────────────────────────────────── */}
							<div>
								<Label className={styles.formLabel} htmlFor="email">
									{t('auth.email', 'Email')}
								</Label>
								<div className={styles.inputWrap}>
									<Mail
										className={`${styles.inputIcon} ${isRTL ? styles.iconR : styles.iconL}`}
										strokeWidth={1.5}
									/>
									<Input
										ref={emailRef}
										id="email"
										type="email"
										autoComplete="email"
										value={email}
										onChange={(e) => {
											setEmail(e.target.value);
											if (touched.email) {
												const err = validateField('email', e.target.value);
												setErrors((p) => ({ ...p, email: err ?? '' }));
											}
										}}
										onBlur={() => {
											setTouched((p) => ({ ...p, email: true }));
											const err = validateField('email', email);
											setErrors((p) => ({ ...p, email: err ?? '' }));
										}}
										placeholder={t('authRegister.emailPlaceholder', 'your@email.com')}
										className={`${isRTL ? styles.inputR : styles.inputL} h-12 text-sm rounded ${
											fieldError('email') ? styles.inputError : styles.input
										}`}
										dir="ltr"
									/>
									{detectedEmailKind === 'email' && email.length > 3 && (
										<span className={styles.detectedBadge}>
											<Mail className="w-3 h-3" /> {t('authLogin.detectedEmail', 'Email')}
										</span>
									)}
								</div>
								{fieldError('email') && (
									<p className={styles.fieldError}>{fieldError('email')}</p>
								)}
							</div>

							{/* ── Phone (sellers only) ──────────────────────── */}
							{accountType === 'seller' && (
								<div>
									<Label className={styles.formLabel} htmlFor="phone">
										{t('authRegister.phoneLabel', 'Phone number')}
									</Label>
									<div className={styles.inputWrap}>
										<svg
											className={`${styles.inputIcon} ${isRTL ? styles.iconR : styles.iconL}`}
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											strokeWidth={1.5}
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a15.998 15.998 0 006.502 6.502l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
											/>
										</svg>
										<Input
											ref={phoneRef}
											id="phone"
											type="tel"
											inputMode="tel"
											autoComplete="tel"
											value={phone}
											onChange={(e) => {
												setPhone(e.target.value);
												if (touched.phone) {
													const err = validateField('phone', e.target.value);
													setErrors((p) => ({ ...p, phone: err ?? '' }));
												}
											}}
											onBlur={() => {
												setTouched((p) => ({ ...p, phone: true }));
												const err = validateField('phone', phone);
												setErrors((p) => ({ ...p, phone: err ?? '' }));
											}}
											placeholder={t('authLogin.phonePlaceholder', '+9677…')}
											className={`${isRTL ? styles.inputR : styles.inputL} h-12 text-sm rounded ${
												fieldError('phone') ? styles.inputError : styles.input
											}`}
											dir="ltr"
										/>
									</div>
									{fieldError('phone') && (
										<p className={styles.fieldError}>{fieldError('phone')}</p>
									)}
								</div>
							)}

							{/* ── Password with strength meter ──────────────── */}
							<div>
								<Label className={styles.formLabel} htmlFor="password">
									{t('auth.password', 'Password')}
								</Label>
								<div className={styles.inputWrap}>
									<svg
										className={`${styles.inputIcon} ${isRTL ? styles.iconR : styles.iconL}`}
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										strokeWidth={1.5}
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
										/>
									</svg>
									<Input
										ref={passwordRef}
										id="password"
										type={showPassword ? 'text' : 'password'}
										autoComplete="new-password"
										value={password}
										onChange={(e) => {
											setPassword(e.target.value);
											if (touched.password) {
												const err = validateField('password', e.target.value);
												setErrors((p) => ({ ...p, password: err ?? '' }));
											}
										}}
										onBlur={() => {
											setTouched((p) => ({ ...p, password: true }));
											const err = validateField('password', password);
											setErrors((p) => ({ ...p, password: err ?? '' }));
										}}
										placeholder={t('authRegister.passwordPlaceholder', 'At least 10 characters')}
										className={`${isRTL ? styles.inputRboth : styles.inputLboth} h-12 text-sm rounded ${
											fieldError('password') ? styles.inputError : styles.input
										}`}
										dir="ltr"
									/>
									<button
										type="button"
										onClick={() => setShowPassword(!showPassword)}
										className={`${styles.inputIcon} ${isRTL ? styles.iconL : styles.iconR} ${styles.passwordToggle}`}
										aria-label={
											showPassword
												? t('authLogin.hidePassword', 'Hide password')
												: t('authLogin.showPassword', 'Show password')
										}
									>
										{showPassword ? (
											<EyeOff className="w-5 h-5" strokeWidth={1.5} />
										) : (
											<Eye className="w-5 h-5" strokeWidth={1.5} />
										)}
									</button>
								</div>
								{/* Strength meter — 5-segment bar */}
								{password && (
									<div className="mt-2">
										<div className={`strengthMeter ${strength.key}`}>
											<div className="strengthBar strengthBar1" />
											<div className="strengthBar strengthBar2" />
											<div className="strengthBar strengthBar3" />
											<div className="strengthBar strengthBar4" />
											<div className="strengthBar strengthBar5" />
										</div>
										<p className={`strengthLabel ${strength.key}`}>
											{strength.key === 'weak' && t('authPasswordStrength.weak', 'Weak')}
											{strength.key === 'medium' && t('authPasswordStrength.medium', 'Medium')}
											{strength.key === 'good' && t('authPasswordStrength.good', 'Good')}
											{strength.key === 'strong' && t('authPasswordStrength.strong', 'Strong')}
											{strength.key === 'excellent' && t('authPasswordStrength.excellent', 'Excellent')}
										</p>
									</div>
								)}
								{fieldError('password') && (
									<p className={styles.fieldError}>{fieldError('password')}</p>
								)}
							</div>

							{/* ── Confirm Password ────────────────────────────── */}
							<div>
								<Label className={styles.formLabel} htmlFor="confirmPassword">
									{t('auth.confirmPassword', 'Confirm password')}
								</Label>
								<div className={styles.inputWrap}>
									<svg
										className={`${styles.inputIcon} ${isRTL ? styles.iconR : styles.iconL}`}
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										strokeWidth={1.5}
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
										/>
									</svg>
									<Input
										id="confirmPassword"
										type={showConfirm ? 'text' : 'password'}
										autoComplete="new-password"
										value={confirmPassword}
										onChange={(e) => {
											setConfirmPassword(e.target.value);
											if (touched.confirmPassword) {
												const err = validateField('confirmPassword', e.target.value);
												setErrors((p) => ({ ...p, confirmPassword: err ?? '' }));
											}
										}}
										onBlur={() => {
											setTouched((p) => ({ ...p, confirmPassword: true }));
											const err = validateField('confirmPassword', confirmPassword);
											setErrors((p) => ({ ...p, confirmPassword: err ?? '' }));
										}}
										placeholder={t('authRegister.confirmPasswordPlaceholder', 'Re-enter your password')}
										className={`${isRTL ? styles.inputRboth : styles.inputLboth} h-12 text-sm rounded ${
											fieldError('confirmPassword') ? styles.inputError : styles.input
										}`}
										dir="ltr"
									/>
									<button
										type="button"
										onClick={() => setShowConfirm(!showConfirm)}
										className={`${styles.inputIcon} ${isRTL ? styles.iconL : styles.iconR} ${styles.passwordToggle}`}
										aria-label={
											showConfirm
												? t('authLogin.hidePassword', 'Hide password')
												: t('authLogin.showPassword', 'Show password')
										}
									>
										{showConfirm ? (
											<EyeOff className="w-5 h-5" strokeWidth={1.5} />
										) : (
											<Eye className="w-5 h-5" strokeWidth={1.5} />
										)}
									</button>
								</div>
								{confirmPassword && !fieldError('confirmPassword') && (
									<p className="text-xs mt-1 text-green-600 flex items-center gap-1">
										<Check className="w-3 h-3" /> {t('authCommon.passwordsMatch', 'Passwords match')}
									</p>
								)}
								{fieldError('confirmPassword') && (
									<p className={styles.fieldError}>{fieldError('confirmPassword')}</p>
								)}
							</div>

							{/* ── Terms checkbox (accessible) ──────────────────── */}
							<div>
								<label className={styles.checkboxLabel}>
									<input
										type="checkbox"
										checked={terms}
										onChange={(e) => {
											setTerms(e.target.checked);
											setErrors((p) => ({ ...p, terms: '' }));
										}}
										className={styles.checkbox}
									/>
									<span className={`text-xs leading-relaxed ${styles.formSubtitle}`}>
										{t(
											'auth.iAgree',
											'I agree to the Terms of Service and Privacy Policy',
										)}
									</span>
								</label>
								{fieldError('terms') && (
									<p className={styles.fieldError}>{fieldError('terms')}</p>
								)}
							</div>

							{/* ── Submit ───────────────────────────────────────────── */}
							<Button
								type="submit"
								disabled={isLoading}
								className={`${styles.btnPrimary} ${styles.submitBtn}`}
								aria-busy={isLoading}
							>
								{isLoading ? (
									<>
										<Loader2 className="w-4 h-4 animate-spin" />
										<span>{t('authRegister.creatingAccount', 'Creating your account…')}</span>
									</>
								) : (
									<>
										<UserPlus className="w-4 h-4" strokeWidth={1.5} />
										<span>{t('auth.registerBtn', 'Create Account')}</span>
									</>
								)}
							</Button>

							{/* ── Switch to login ─────────────────────────────── */}
							<p className={styles.registerRow}>
								{t('auth.haveAccount', 'Already have an account?')}{' '}
								<Link to="/auth/login" className={styles.ctaLink}>
									{t('auth.loginTitle', 'Login')}
									<NextIcon className="w-3 h-3 inline ms-1" strokeWidth={1.5} />
								</Link>
							</p>
						</form>
					</div>

					{/* Trust footer */}
					<footer className={styles.formFooter}>
						<div className={styles.footerItem}>
							<ShieldCheck className="w-3 h-3 text-aliOrange" strokeWidth={2} />
							<span>{t('authLogin.sslSecured', 'SSL Secured')}</span>
						</div>
						<span className={styles.footerDot}>·</span>
						<div className={styles.footerItem}>
							<LogIn className="w-3 h-3 text-aliOrange" strokeWidth={2} />
							<span>{t('authLogin.twoFactorAvailable', '2FA Available')}</span>
						</div>
					</footer>
				</div>
			</main>
		</div>
	);
}
