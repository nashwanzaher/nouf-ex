import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
	AlertCircle,
	ArrowRight,
	ArrowLeft,
	CircleUserRound,
	Eye,
	EyeOff,
	KeyRound,
	Loader2,
	LogIn,
	Mail,
	Phone,
	QrCode,
	ShieldCheck,
	Smartphone,
	Sparkles,
	User,
	Wallet,
	X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AppContext';
import {
	login as apiLogin,
	verify2FA,
	getCurrentUser,
	ApiError,
} from '@/lib/api';
import styles from './Login.module.css';
import { detectIdentifier } from './utils';

// ── Login method tabs (Email / Phone / QR) ────────────────────────────────
// Mirrors Taobao/AliExpress pattern where users choose how to authenticate
// without having to navigate to a separate page.
type LoginMethod = 'email' | 'phone' | 'qr';

interface LocationState {
	from?: string;
}

// Detect Caps-Lock state to surface a hint before the user wastes time
// typing a wrong password. Cheap, runs on every keydown.
function isCapsLockOn(ev: KeyboardEvent | React.KeyboardEvent): boolean {
	if (typeof ev.getModifierState === 'function') {
		return ev.getModifierState('CapsLock');
	}
	return false;
}

// ── Friendly error mapping ────────────────────────────────────────────────
// Maps the server's stable machine codes (see lib/error-codes.ts) to
// actionable advice in the user's language via i18n. Generic strings have
// low recovery rates — actionable ones increase login success by ~18% (Baymard).
//
// We use the `(key, options)` overload (object form) so the i18next
// TFunction type is assignable without casts.
type TranslateWithDefault = (
	key: string,
	options: { defaultValue: string },
) => string;

function friendlyAuthError(
	code: string | undefined,
	fallback: string,
	t: TranslateWithDefault,
): string {
	if (!code) return fallback;
	switch (code) {
		case 'INVALID_CREDENTIALS':
		case 'WRONG_PASSWORD':
			return t('authLogin.errInvalidCreds', {
				defaultValue: 'Email or password is incorrect. Double-check and try again.',
			});
		case 'RATE_LIMITED':
			return t('authLogin.errRateLimited', {
				defaultValue: 'Too many attempts. Please wait a minute before trying again.',
			});
		case 'ACCOUNT_SUSPENDED':
			return t('authLogin.errSuspended', {
				defaultValue: 'Your account has been suspended. Contact support to reactivate.',
			});
		case 'ACCOUNT_BANNED':
			return t('authLogin.errBanned', {
				defaultValue: 'This account has been banned. Please contact support.',
			});
		case 'EMAIL_NOT_VERIFIED':
			return t('authLogin.errEmailUnverified', {
				defaultValue: 'Please verify your email first — check your inbox for the link.',
			});
		case 'NETWORK':
			return t('authLogin.errNetwork', {
				defaultValue: 'Network error. Check your connection and try again.',
			});
		case 'CSRF_INVALID':
			return t('authLogin.errCsrf', {
				defaultValue: 'Security token expired. Please reload the page.',
			});
		default:
			return fallback;
	}
}

export default function Login() {
	const { t, i18n } = useTranslation();
	const isRTL = i18n.language === 'ar';
	const navigate = useNavigate();
	const location = useLocation();
	const { login: authLogin, addToast } = useAuth();

	// ── Method (email/phone/qr) + Form fields ──────────────────────────
	// Both reads happen via lazy useState initializers so we don't trigger
	// the react-hooks/set-state-in-effect lint rule (no cascading renders
	// on mount) AND we don't need a separate useEffect for "remember me".
	const [method, setMethod] = useState<LoginMethod>(() => {
		try {
			const v = localStorage.getItem('noufex_remembered_identifier');
			return v && detectIdentifier(v) === 'phone' ? 'phone' : 'email';
		} catch {
			return 'email';
		}
	});
	const [identifier, setIdentifier] = useState<string>(() => {
		try {
			const v = localStorage.getItem('noufex_remembered_identifier');
			return v && v.length > 0 ? v : '';
		} catch {
			return '';
		}
	});
	const [password, setPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [rememberMe, setRememberMe] = useState(true); // default ON (industry standard)
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [capsLockOn, setCapsLockOn] = useState(false);

	// ── 2FA inline sub-form ────────────────────────────────────────────
	const [twoFactorPending, setTwoFactorPending] = useState<
		{ partial_token: string; user_id: number } | null
	>(null);
	const [twoFactorCode, setTwoFactorCode] = useState('');

	// ── Loading / network state ─────────────────────────────────────────
	const [isLoading, setIsLoading] = useState(false);
	const [loadingMessage, setLoadingMessage] = useState<string>('');
	const [networkRetries, setNetworkRetries] = useState(0);

	// ── Refs for focus management ───────────────────────────────────────
	const identifierRef = useRef<HTMLInputElement>(null);
	const passwordRef = useRef<HTMLInputElement>(null);
	const twoFactorRef = useRef<HTMLInputElement>(null);

	// ── Computed ────────────────────────────────────────────────────────
	const detectedKind = useMemo(() => detectIdentifier(identifier), [identifier]);

	// Auto-focus on the identifier input on mount (Amazon pattern).
	useEffect(() => {
		// Defer to next tick so the input is mounted.
		const t = setTimeout(() => {
			identifierRef.current?.focus();
		}, 200);
		return () => clearTimeout(t);
	}, []);

	// ── Landing page by role ─────────────────────────────────────────────
	const landingForRole = (role: string): string => {
		if (role === 'admin') return '/admin';
		if (role === 'merchant') return '/seller';
		return '/customer';
	};

	// ── Validation ──────────────────────────────────────────────────────
	const validate = () => {
		const errs: Record<string, string> = {};
		const v = identifier.trim();
		if (!v) {
			errs.identifier = t('authCommon.fieldRequired', 'This field is required');
		} else if (method === 'email' && detectedKind !== 'email') {
			errs.identifier = t(
				'authCommon.invalidEmail',
				'Please enter a valid email address',
			);
		} else if (method === 'phone' && detectedKind !== 'phone') {
			errs.identifier = t(
				'authCommon.invalidPhone',
				'Please enter a valid phone number',
			);
		}
		if (!password) {
			errs.password = t('authCommon.fieldRequired', 'This field is required');
		} else if (password.length < 8) {
			errs.password = t(
				'authCommon.passwordMinLength',
				'Password must be at least 8 characters',
			);
		}
		setErrors(errs);
		return Object.keys(errs).length === 0;
	};

	// ── Submit handler ──────────────────────────────────────────────────
	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!validate()) return;

		setIsLoading(true);
		setLoadingMessage(t('authLogin.signingIn', 'Signing you in…'));
		setErrors({});

		try {
			const result = await apiLogin({
				email: identifier.trim(),
				password,
			});

			if (result.kind === '2fa_required') {
				setTwoFactorPending({
					partial_token: result.partial_token,
					user_id: result.user_id,
				});
				addToast({
					message: t(
						'authLogin.twoFactorRequired',
						'Enter the 6-digit code from your authenticator app.',
					),
					type: 'info',
				});
				setLoadingMessage('');
				setIsLoading(false);
				setTimeout(() => twoFactorRef.current?.focus(), 200);
				return;
			}

			// Persist "remember me" preference.
			if (rememberMe) {
				try {
					localStorage.setItem('noufex_remembered_identifier', identifier.trim());
				} catch {
					/* ignore quota errors */
				}
			} else {
				try {
					localStorage.removeItem('noufex_remembered_identifier');
				} catch {
					/* ignore */
				}
			}

			// Map server `User` → AppContext `User`.
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
				message: t('authLogin.signInSuccess', 'Signed in successfully'),
				type: 'success',
			});

			// SECURITY (OWASP ASVS 3.5.1): validate redirect URL is a
			// relative path to prevent open redirect attacks. An attacker
			// could craft ?redirect=https://evil.com to steal credentials
			// after login. We only accept paths starting with '/' that
			// don't start with '//' (protocol-relative URL) and don't
			// contain '://' (absolute URL).
			const rawRedirect =
				(location.state as LocationState | null)?.from ??
				new URLSearchParams(location.search).get('redirect');
			const isSafeRedirect =
				rawRedirect &&
				rawRedirect.startsWith('/') &&
				!rawRedirect.startsWith('//') &&
				!rawRedirect.includes('://');
			const destination = isSafeRedirect ? rawRedirect : landingForRole(authUser.role);
			navigate(destination, { replace: true });
		} catch (err) {
			setLoadingMessage('');
			let friendlyMessage: string;
			if (err instanceof ApiError) {
				friendlyMessage = friendlyAuthError(err.code, err.message, t);
			} else {
				const fallback =
					err instanceof Error
						? err.message
						: t('authLogin.signInError', 'Could not sign in. Please try again.');
				friendlyMessage = friendlyAuthError(undefined, fallback, t);
				// Suggest retry for network issues.
				setNetworkRetries((r) => r + 1);
			}
			setErrors({ form: friendlyMessage });
			addToast({ message: friendlyMessage, type: 'error' });
			passwordRef.current?.focus();
		} finally {
			setIsLoading(false);
		}
	};

	// ── 2FA verification ────────────────────────────────────────────────
	const handleVerifyTwoFactor = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!twoFactorPending) return;
		if (!/^\d{6}$/.test(twoFactorCode.trim())) {
			setErrors({ form: t('authLogin.twoFactorInvalid', 'Enter the 6-digit code.') });
			return;
		}
		setIsLoading(true);
		setLoadingMessage(t('authLogin.verifying', 'Verifying your code…'));
		try {
			await verify2FA({
				partial_token: twoFactorPending.partial_token,
				code: twoFactorCode.trim(),
			});
			const userPayload = await getCurrentUser();
			const authUser = {
				id: String(userPayload.id),
				name: userPayload.full_name,
				email: userPayload.email,
				role:
					(userPayload.role as 'customer' | 'merchant' | 'admin' | 'guest') ||
					'customer',
				avatar: userPayload.avatar ?? undefined,
			};
			authLogin(authUser);
			addToast({
				message: t('authLogin.signInSuccess', 'Signed in successfully'),
				type: 'success',
			});
			const destination = landingForRole(authUser.role);
			navigate(destination, { replace: true });
		} catch (err) {
			setLoadingMessage('');
			const msg =
				err instanceof ApiError
					? err.message
					: t('authLogin.signInError', 'Could not sign in. Please try again.');
			setErrors({
				form: friendlyAuthError(
					err instanceof ApiError ? err.code : undefined,
					msg,
					t,
				),
			});
			setTwoFactorCode('');
			twoFactorRef.current?.focus();
		} finally {
			setIsLoading(false);
		}
	};

	// ── Auto-advance: when email is filled & valid, jump to password ───
	const handleIdentifierKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		setCapsLockOn(isCapsLockOn(e));
		if (e.key === 'Enter' && detectedKind !== 'unknown') {
			e.preventDefault();
			passwordRef.current?.focus();
		}
	};

	const handlePasswordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		setCapsLockOn(isCapsLockOn(e));
		if (e.key === 'Enter') {
			e.preventDefault();
			void handleSubmit(e as unknown as React.FormEvent);
		}
	};

	// ── Arrow icon for "next/back" based on RTL ───────────────────────
	const NextIcon = isRTL ? ArrowLeft : ArrowRight;
	const PrevIcon = isRTL ? ArrowRight : ArrowLeft;

	// ── JSX ────────────────────────────────────────────────────────────
	return (
		<div className={`min-h-[100dvh] flex bg-white ${styles.page}`} dir={isRTL ? 'rtl' : 'ltr'}>
			{/* ─────────────────────── Hero Panel (Left) ─────────────────────── */}
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
						{t('authLogin.brandName', 'Nouf-ex')}
					</h1>
					<p className={styles.heroSubtitle}>
						{t('authLogin.heroMena', 'Your Gateway to MENA Commerce')}
					</p>

					{/* Trust stats */}
					<div className={styles.statsGrid}>
						<div className={styles.statCard}>
							<User className={styles.statIconOrange} strokeWidth={1.5} />
							<span className={styles.statLabel}>{t('authCommon.statSellers', '10K+ Sellers')}</span>
						</div>
						<div className={styles.statCard}>
							<Wallet className={styles.statIconBlue} strokeWidth={1.5} />
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

			{/* ─────────────────────── Form Panel (Right) ─────────────────────── */}
			<main className={styles.formPanel}>
				{/* Language switcher + back-to-home */}
				<div className={styles.formHeader}>
					<button
						type="button"
						className={styles.headerBtn}
						aria-label={t('authLogin.changeLanguage', 'Change language')}
					>
						{/* small inline language switcher placeholder */}
						<Smartphone className="w-4 h-4" strokeWidth={1.5} />
					</button>
					<Link to="/" className={styles.headerBtn}>
						{t('authLogin.backToHome', 'Back to home')}
					</Link>
				</div>

				<div className={styles.formCenter}>
					<div className={styles.formCard}>
						{/* Header */}
						<header className={styles.formHeaderSection}>
							<h1 className={styles.formTitle}>
								{t('auth.loginTitle', 'Login')}
							</h1>
							<p className={styles.formSubtitle}>
								{t('authLogin.subtitle', 'Welcome back to Nouf-ex')}
							</p>
						</header>

						{/* ── Method Tabs (Email / Phone / QR) ────────────────────────── */}
						<div className={styles.methodTabs} role="tablist">
							<button
								role="tab"
								type="button"
								aria-selected={method === 'email'}
								className={`${styles.methodTab} ${method === 'email' ? styles.methodTabActive : ''}`}
								onClick={() => setMethod('email')}
							>
								<Mail className="w-4 h-4" strokeWidth={1.5} />
								<span>{t('authLogin.tabEmail', 'Email')}</span>
							</button>
							<button
								role="tab"
								type="button"
								aria-selected={method === 'phone'}
								className={`${styles.methodTab} ${method === 'phone' ? styles.methodTabActive : ''}`}
								onClick={() => setMethod('phone')}
							>
								<Phone className="w-4 h-4" strokeWidth={1.5} />
								<span>{t('authLogin.tabPhone', 'Phone')}</span>
							</button>
							<button
								role="tab"
								type="button"
								aria-selected={method === 'qr'}
								className={`${styles.methodTab} ${method === 'qr' ? styles.methodTabActive : ''}`}
								onClick={() => setMethod('qr')}
							>
								<QrCode className="w-4 h-4" strokeWidth={1.5} />
								<span>{t('authLogin.tabQr', 'QR Code')}</span>
							</button>
						</div>

						{/* ── QR Code Login Panel ─────────────────────────────────────── */}
						{method === 'qr' ? (
							<div className={styles.qrPanel}>
								<div className={styles.qrCodeBox}>
									<div className={styles.qrPlaceholder}>
										<QrCode className="w-32 h-32 text-aliOrange" strokeWidth={1.5} />
									</div>
									{/* In production: render a dynamic QR from /api/auth/qr-token */}
								</div>
								<p className={styles.qrTitle}>
									{t('authLogin.qrTitle', 'Scan with the Nouf-ex mobile app')}
								</p>
								<p className={styles.qrHelp}>
									{t(
										'authLogin.qrHelp',
										'Open the app → tap the QR icon in the top-right corner → point it at this code.',
									)}
								</p>
								<button
									type="button"
									className={styles.qrFallback}
									onClick={() => setMethod('email')}
								>
									<PrevIcon className="w-4 h-4 inline me-1" strokeWidth={1.5} />
									{t('authLogin.useEmailInstead', 'Use email instead')}
								</button>
							</div>
						) : (
							/* ── Email / Phone Login Form ────────────────────────────── */
							<form
								onSubmit={handleSubmit}
								noValidate
								className={styles.formBody}
								aria-busy={isLoading}
							>
								{/* Global form-level error (e.g. wrong creds, rate-limited) */}
								{errors.form && (
									<div
										role="alert"
										aria-live="polite"
										className={styles.formAlert}
									>
										<AlertCircle className="w-4 h-4 inline me-1.5" strokeWidth={2} />
										{errors.form}
										{networkRetries > 0 && (
											<span className={styles.alertRetry}>
												{t('authLogin.retryHint', 'Tap the password field and press Enter to retry.')}
											</span>
										)}
									</div>
								)}

								{/* ── 2FA inline sub-form ─────────────────────────────────────── */}
								{twoFactorPending && (
									<div className={styles.twoFactorBox}>
										<div className={styles.twoFactorHeader}>
											<div className="flex items-center gap-2">
												<KeyRound className="w-4 h-4 text-aliOrange" strokeWidth={1.5} />
												<p className={styles.twoFactorTitle}>
													{t('authLogin.twoFactorTitle', 'Two-factor code')}
												</p>
											</div>
											<button
												type="button"
												className={styles.linkCancel}
												onClick={() => {
													setTwoFactorPending(null);
													setTwoFactorCode('');
													setErrors({});
												}}
											>
												<X className="w-3 h-3 inline me-1" strokeWidth={2} />
												{t('common.cancel', 'Cancel')}
											</button>
										</div>
										<p className={styles.twoFactorHelp}>
											{t(
												'authLogin.twoFactorHelp',
												'Open your authenticator app and enter the 6-digit code.',
											)}
										</p>
										<Input
											ref={twoFactorRef}
											inputMode="numeric"
											autoComplete="one-time-code"
											pattern="[0-9]{6}"
											maxLength={6}
											value={twoFactorCode}
											onChange={(e) => {
												setTwoFactorCode(e.target.value.replace(/\D/g, ''));
												setErrors((p) => ({ ...p, form: '' }));
											}}
											placeholder="••••••"
											className={`${styles.inputOTP} ${styles.input}`}
											aria-label={t('authLogin.twoFactorTitle', 'Two-factor code')}
										/>
										<Button
											type="button"
											disabled={isLoading || twoFactorCode.length !== 6}
											onClick={(e) => void handleVerifyTwoFactor(e)}
											className={`${styles.btnPrimary} ${styles.twoFactorBtn}`}
										>
											{isLoading ? (
												<>
													<Loader2 className="w-4 h-4 animate-spin" />
													<span>{loadingMessage || t('authLogin.verifying', 'Verifying…')}</span>
												</>
											) : (
												<>
													<LogIn className="w-4 h-4" strokeWidth={1.5} />
													<span>{t('authLogin.verify', 'Verify')}</span>
												</>
											)}
										</Button>
									</div>
								)}

								{/* ── Identifier (email or phone) ───────────────────────────── */}
								<div>
									<Label className={styles.formLabel} htmlFor="identifier">
										{method === 'email'
											? t('auth.email', 'Email')
											: t('authLogin.phone', 'Phone number')}
									</Label>
									<div className={styles.inputWrap}>
										{method === 'email' ? (
											<Mail
												className={`${styles.inputIcon} ${isRTL ? styles.iconR : styles.iconL}`}
												strokeWidth={1.5}
											/>
										) : (
											<Phone
												className={`${styles.inputIcon} ${isRTL ? styles.iconR : styles.iconL}`}
												strokeWidth={1.5}
											/>
										)}
										<Input
											ref={identifierRef}
											id="identifier"
											type={method === 'email' ? 'email' : 'tel'}
											inputMode={method === 'email' ? 'email' : 'tel'}
											value={identifier}
											onChange={(e) => {
												setIdentifier(e.target.value);
												setErrors((p) => ({ ...p, identifier: '' }));
											}}
											onKeyDown={handleIdentifierKeyDown}
											placeholder={
												method === 'email'
													? t(
															'authLogin.emailOrPhonePlaceholder',
															'Your email or phone number',
													  )
													: t('authLogin.phonePlaceholder', '+9677…')
											}
											className={`${isRTL ? styles.inputR : styles.inputL} h-12 text-sm rounded ${
												errors.identifier ? styles.inputError : styles.input
											}`}
											dir="ltr"
											autoComplete={method === 'email' ? 'username' : 'tel'}
										/>
										{/* Auto-detect indicator: shows the user we're smart */}
										{detectedKind !== 'unknown' && identifier.length > 3 && (
											<span className={styles.detectedBadge}>
												{detectedKind === 'email' ? (
													<>
														<Mail className="w-3 h-3" /> {t('authLogin.detectedEmail', 'Email')}
													</>
												) : (
													<>
														<Phone className="w-3 h-3" /> {t('authLogin.detectedPhone', 'Phone')}
													</>
												)}
											</span>
										)}
									</div>
									{errors.identifier && (
										<p className={styles.fieldError}>{errors.identifier}</p>
									)}
								</div>

								{/* ── Password with CapsLock warning ────────────────────────── */}
								<div>
									<div className={styles.passwordLabelRow}>
										<Label className={styles.formLabel} htmlFor="password">
											{t('auth.password', 'Password')}
										</Label>
										<Link
											to="/auth/forgot-password"
											className={styles.linkInline}
										>
											{t('auth.forgotPassword', 'Forgot password?')}
										</Link>
									</div>
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
											autoComplete="current-password"
											value={password}
											onChange={(e) => {
												setPassword(e.target.value);
												setErrors((p) => ({ ...p, password: '' }));
											}}
											onKeyDown={handlePasswordKeyDown}
											placeholder={t('authLogin.passwordPlaceholder', 'Password')}
											className={`${isRTL ? styles.inputRboth : styles.inputLboth} h-12 text-sm rounded ${
												errors.password ? styles.inputError : styles.input
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
									{/* CapsLock warning - prevents frustration */}
									{capsLockOn && (
										<p className={styles.capsLockWarn}>
											<AlertCircle className="w-3 h-3 inline me-1" strokeWidth={2} />
											{t('authLogin.capsLockOn', 'Caps Lock is on')}
										</p>
									)}
									{errors.password && (
										<p className={styles.fieldError}>{errors.password}</p>
									)}
								</div>

								{/* ── Remember me + Forgot password row ─────────────────────── */}
								<div className={styles.rememberRow}>
									<label className={styles.checkboxLabel}>
										<input
											type="checkbox"
											checked={rememberMe}
											onChange={(e) => setRememberMe(e.target.checked)}
											className={styles.checkbox}
										/>
										<span>{t('authLogin.rememberMe', 'Keep me signed in')}</span>
									</label>
								</div>

								{/* ── Submit ────────────────────────────────────────────────────── */}
								<Button
									type="submit"
									disabled={isLoading}
									className={`${styles.btnPrimary} ${styles.submitBtn}`}
									aria-busy={isLoading}
								>
									{isLoading ? (
										<>
											<Loader2 className="w-4 h-4 animate-spin" />
											<span>{loadingMessage || t('authLogin.signingIn', 'Signing you in…')}</span>
										</>
									) : (
										<>
											<LogIn className="w-4 h-4" strokeWidth={1.5} />
											<span>{t('auth.loginBtn', 'Sign in')}</span>
										</>
									)}
								</Button>

								{/* ── Switch method link ─────────────────────────────────────── */}
								<div className={styles.switchMethodRow}>
									<button
										type="button"
										className={styles.linkInline}
										onClick={() => setMethod(method === 'email' ? 'phone' : 'email')}
									>
										{method === 'email'
											? t('authLogin.usePhoneInstead', 'Use phone number instead')
											: t('authLogin.useEmailInstead', 'Use email instead')}
									</button>
									<span className={styles.dot}>·</span>
									<button
										type="button"
										className={styles.linkInline}
										onClick={() => setMethod('qr')}
									>
										{t('authLogin.useQr', 'Scan QR')}
									</button>
								</div>
							</form>
						)}

						{/* ── Create account link ─────────────────────────────────────── */}
						<p className={styles.registerRow}>
							{t('authLogin.newUser', 'New user?')}{' '}
							<Link to="/auth/register" className={styles.ctaLink}>
								{t('auth.registerTitle', 'Create Account')}
								<NextIcon className="w-3 h-3 inline ms-1" strokeWidth={1.5} />
							</Link>
						</p>
					</div>

					{/* ── Trust footer ───────────────────────────────────────────── */}
					<footer className={styles.formFooter}>
						<div className={styles.footerItem}>
							<ShieldCheck className="w-3 h-3 text-aliOrange" strokeWidth={2} />
							<span>{t('authLogin.sslSecured', 'SSL Secured')}</span>
						</div>
						<span className={styles.footerDot}>·</span>
						<div className={styles.footerItem}>
							<CircleUserRound className="w-3 h-3 text-aliOrange" strokeWidth={2} />
							<span>{t('authLogin.twoFactorAvailable', '2FA Available')}</span>
						</div>
						<span className={styles.footerDot}>·</span>
						<Link to="/auth/forgot-password" className={styles.footerItem}>
							<KeyRound className="w-3 h-3 text-aliOrange" strokeWidth={2} />
							<span>{t('authLogin.recoverAccess', 'Recover Access')}</span>
						</Link>
					</footer>
				</div>
			</main>
		</div>
	);
}
