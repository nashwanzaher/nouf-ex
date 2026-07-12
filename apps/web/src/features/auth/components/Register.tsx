import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
	Mail,
	Lock,
	Eye,
	EyeOff,
	ShoppingBag,
	Store,
	Globe,
	Shield,
	TrendingUp,
	Users,
	Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AppContext';
import { register, ApiError } from '@/lib/api';
import styles from './Auth.module.css';

export default function Register() {
	const { t, i18n } = useTranslation();
	const isRTL = i18n.language === 'ar';
	const navigate = useNavigate();
	const { login: authLogin, addToast } = useAuth();
	const [accountType, setAccountType] = useState<'buyer' | 'seller'>('buyer');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);
	const [terms, setTerms] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});

	const validate = () => {
		const errs: Record<string, string> = {};
		if (!email.trim()) errs.email = t('authCommon.fieldRequired', 'This field is required');
		else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
			errs.email = t('authCommon.invalidEmail', 'Invalid email');
		if (!password.trim())
			errs.password = t('authCommon.fieldRequired', 'This field is required');
		else if (password.length < 6)
			errs.password = t(
				'authCommon.passwordMinLength',
				'Password must be at least 6 characters',
			);
		else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
			// Weak password warning — not blocking, just advisory
			errs.passwordWarning = t(
				'authCommon.passwordStrength',
				'For better security, use uppercase, lowercase, and numbers',
			);
		}
		if (password !== confirmPassword)
			errs.confirmPassword = t('authCommon.passwordsDoNotMatch', 'Passwords do not match');
		if (!terms) errs.terms = t('authRegister.termsRequired', 'You must agree to the terms');
		setErrors(errs);
		return !errs.email && !errs.password && !errs.confirmPassword && !errs.terms;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!validate()) return;
		setIsLoading(true);
		try {
			// G5 fix 2026-07-11: forward the buyer/seller tab choice to
			// the server. The server coerces anything other than
			// 'customer' or 'merchant' (notably 'admin') back to
			// 'customer', so this is safe to pass straight through.
			const result = await register({
				email: email.trim(),
				password,
				name: email.trim().split('@')[0] || email.trim(),
				role: accountType === 'seller' ? 'merchant' : 'customer',
			});
			const authUser = {
				id: String(result.user.id),
				name: result.user.full_name,
				email: result.user.email,
				role:
					(result.user.role as 'customer' | 'merchant' | 'admin' | 'guest') || 'customer',
				avatar: result.user.avatar ?? undefined,
			};
			// Auth token is set by server as HttpOnly cookie automatically.
			authLogin(authUser);
			addToast({
				message: t('authRegister.accountCreated', 'Account created successfully'),
				type: 'success',
			});
			// G5 fix 2026-07-11: route to the role-appropriate landing
			// page instead of always /customer. New merchants go to
			// the onboarding wizard which creates their first store;
			// everyone else lands on the customer dashboard.
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

	return (
		<div className="min-h-[100dvh] flex" dir={isRTL ? 'rtl' : 'ltr'}>
			{/* Left Panel — Hero */}
			<div
				className={`hidden lg:flex lg:w-[45%] relative flex-col items-center justify-center p-12 overflow-hidden ${styles.hero}`}
			>
				<div
					className={`absolute top-10 right-10 w-64 h-64 rounded-full opacity-20 ${styles.heroCircle}`}
				/>
				<div
					className={`absolute bottom-20 left-10 w-48 h-48 rounded-full opacity-15 ${styles.heroCircle}`}
				/>

				<div className="relative z-10 text-center max-w-md mx-auto">
					<div className="mb-8">
						<div
							className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 ${styles.brandTile}`}
						>
							<Globe className="w-10 h-10 text-white" strokeWidth={1.5} />
						</div>
					</div>

					<h1 className={`text-3xl xl:text-4xl font-bold mb-4 ${styles.heroTitle}`}>
						{t('authRegister.brandName', 'Nouf-ex')}
					</h1>
					<p className={`text-lg xl:text-xl mb-8 leading-relaxed ${styles.heroSubtitle}`}>
						{t(
							'authRegister.heroJoin',
							'Join the largest e-commerce platform in the region',
						)}
					</p>

					<div className="grid grid-cols-3 gap-4 mb-8">
						{[
							{
								icon: Users,
								label: t('authCommon.statSellers', '10K+ Sellers'),
								iconClass: styles.statIconOrange,
							},
							{
								icon: TrendingUp,
								label: t('authCommon.statProducts', '500K+ Products'),
								iconClass: styles.statIconBlue,
							},
							{
								icon: Shield,
								label: t('authCommon.statSecurePayment', 'Secure Payment'),
								iconClass: styles.statIconGreen,
							},
						].map((stat, i) => (
							<div
								key={i}
								className={`flex flex-col items-center gap-2 p-4 rounded-xl ${styles.statCard}`}
							>
								<stat.icon
									className={`w-6 h-6 ${stat.iconClass}`}
									strokeWidth={1.5}
								/>
								<span className={`text-xs font-semibold ${styles.statLabel}`}>
									{stat.label}
								</span>
							</div>
						))}
					</div>

					<Link
						to="/"
						className={`inline-flex items-center gap-2 px-6 py-3 rounded-full text-white font-semibold text-sm transition-colors hover:opacity-90 ${styles.cta}`}
					>
						{t('authCommon.viewMore', 'View More')}
						<TrendingUp className="w-4 h-4" strokeWidth={1.5} />
					</Link>
				</div>
			</div>

			{/* Right Panel — Register Form */}
			<div className={`flex-1 flex flex-col overflow-y-auto ${styles.formPanel}`}>
				<div className="flex-1 flex items-center justify-center p-6 lg:p-12">
					<div className="w-full max-w-[440px] mx-auto">
						<div className="bg-white rounded shadow-sm p-6 lg:p-8">
							{/* Header */}
							<div className="mb-6 text-center">
								<h1 className={`text-2xl font-bold mb-2 ${styles.formTitle}`}>
									{t('auth.registerTitle')}
								</h1>
								<p className={`text-sm ${styles.formSubtitle}`}>
									{t(
										'authRegister.subtitle',
										'Create your account and start your journey',
									)}
								</p>
							</div>

							{/* Account Type */}
							<div className="grid grid-cols-2 gap-3 mb-5">
								<button
									type="button"
									onClick={() => setAccountType('buyer')}
									data-selected={accountType === 'buyer'}
									className={`flex flex-col items-center gap-2 p-4 rounded border-2 transition-all duration-200 ${styles.accountTypeBtn}`}
								>
									<ShoppingBag
										className={`w-6 h-6 ${styles.icon}`}
										strokeWidth={1.5}
									/>
									<span className={`text-sm font-semibold ${styles.formLabel}`}>
										{t('authRegister.buyerTab', 'Buyer')}
									</span>
								</button>
								<button
									type="button"
									onClick={() => setAccountType('seller')}
									data-selected={accountType === 'seller'}
									className={`flex flex-col items-center gap-2 p-4 rounded border-2 transition-all duration-200 ${styles.accountTypeBtn}`}
								>
									<Store className={`w-6 h-6 ${styles.icon}`} strokeWidth={1.5} />
									<span className={`text-sm font-semibold ${styles.formLabel}`}>
										{t('authRegister.sellerTab', 'Seller')}
									</span>
								</button>
							</div>

							<form onSubmit={handleSubmit} className="space-y-4">
								{errors.form && (
									<div
										role="alert"
										className={`text-sm p-3 rounded ${styles.formAlert}`}
									>
										{errors.form}
									</div>
								)}
								{/* Email */}
								<div>
									<Label
										className={`text-sm font-medium mb-1.5 block ${styles.formLabel}`}
									>
										{t('auth.email')}
									</Label>
									<div className="relative">
										<Mail
											className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 ${isRTL ? 'right-3' : 'left-3'} ${styles.inputIcon}`}
											strokeWidth={1.5}
										/>
										<Input
											type="email"
											value={email}
											onChange={(e) => {
												setEmail(e.target.value);
												setErrors((p) => ({ ...p, email: '' }));
											}}
											placeholder={t(
												'authRegister.emailPlaceholder',
												'your@email.com',
											)}
											className={`${isRTL ? 'pr-10' : 'pl-10'} h-12 text-sm rounded ${errors.email ? styles.inputError : styles.input}`}
										/>
									</div>
									{errors.email && (
										<p className={`text-xs mt-1 ${styles.fieldError}`}>
											{errors.email}
										</p>
									)}
								</div>

								{/* Password */}
								<div>
									<Label
										className={`text-sm font-medium mb-1.5 block ${styles.formLabel}`}
									>
										{t('auth.password')}
									</Label>
									<div className="relative">
										<Lock
											className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 ${isRTL ? 'right-3' : 'left-3'} ${styles.inputIcon}`}
											strokeWidth={1.5}
										/>
										<Input
											type={showPassword ? 'text' : 'password'}
											value={password}
											onChange={(e) => {
												setPassword(e.target.value);
												setErrors((p) => ({ ...p, password: '' }));
											}}
											placeholder={t(
												'authRegister.passwordPlaceholder',
												'Password',
											)}
											className={`${isRTL ? 'pr-10 pl-10' : 'pl-10 pr-10'} h-12 text-sm rounded ${errors.password ? styles.inputError : styles.input}`}
										/>
										<button
											type="button"
											onClick={() => setShowPassword(!showPassword)}
											className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'left-3' : 'right-3'} ${styles.inputIcon}`}
										>
											{showPassword ? (
												<EyeOff className="w-5 h-5" strokeWidth={1.5} />
											) : (
												<Eye className="w-5 h-5" strokeWidth={1.5} />
											)}
										</button>
									</div>
									{errors.password && (
										<p className={`text-xs mt-1 ${styles.fieldError}`}>
											{errors.password}
										</p>
									)}
									{errors.passwordWarning && !errors.password && (
										<p className="text-xs mt-1 text-amber-600">
											{errors.passwordWarning}
										</p>
									)}
								</div>

								{/* Confirm Password */}
								<div>
									<Label
										className={`text-sm font-medium mb-1.5 block ${styles.formLabel}`}
									>
										{t('auth.confirmPassword')}
									</Label>
									<div className="relative">
										<Lock
											className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 ${isRTL ? 'right-3' : 'left-3'} ${styles.inputIcon}`}
											strokeWidth={1.5}
										/>
										<Input
											type={showConfirm ? 'text' : 'password'}
											value={confirmPassword}
											onChange={(e) => {
												setConfirmPassword(e.target.value);
												setErrors((p) => ({ ...p, confirmPassword: '' }));
											}}
											placeholder={t(
												'authRegister.confirmPasswordPlaceholder',
												'Confirm password',
											)}
											className={`${isRTL ? 'pr-10 pl-10' : 'pl-10 pr-10'} h-12 text-sm rounded ${errors.confirmPassword ? styles.inputError : styles.input}`}
										/>
										<button
											type="button"
											onClick={() => setShowConfirm(!showConfirm)}
											className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'left-3' : 'right-3'} ${styles.inputIcon}`}
										>
											{showConfirm ? (
												<EyeOff className="w-5 h-5" strokeWidth={1.5} />
											) : (
												<Eye className="w-5 h-5" strokeWidth={1.5} />
											)}
										</button>
									</div>
									{errors.confirmPassword && (
										<p className={`text-xs mt-1 ${styles.fieldError}`}>
											{errors.confirmPassword}
										</p>
									)}
								</div>

								{/* Terms */}
								<div>
									<button
										type="button"
										onClick={() => {
											setTerms(!terms);
											setErrors((p) => ({ ...p, terms: '' }));
										}}
										className="flex items-start gap-2 text-left w-full"
									>
										<div
											data-checked={terms}
											className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${styles.termsBox}`}
										>
											{terms && (
												<Check
													className="w-3 h-3 text-white"
													strokeWidth={2}
												/>
											)}
										</div>
										<span
											className={`text-xs leading-relaxed ${styles.formSubtitle}`}
										>
											{t(
												'auth.iAgree',
												'I agree to the Terms of Service and Privacy Policy',
											)}
										</span>
									</button>
									{errors.terms && (
										<p className={`text-xs mt-1 ${styles.fieldError}`}>
											{errors.terms}
										</p>
									)}
								</div>

								{/* Submit */}
								<Button
									type="submit"
									disabled={isLoading}
									className={`w-full h-12 text-white font-bold text-base rounded transition-colors hover:opacity-90 ${styles.submit}`}
								>
									{isLoading ? (
										<div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
									) : (
										t('auth.registerBtn')
									)}
								</Button>
							</form>

							{/* Switch to login */}
							<p className={`mt-6 text-center text-sm ${styles.formSubtitle}`}>
								{t('auth.haveAccount')}{' '}
								<Link
									to="/auth/login"
									className={`font-semibold hover:underline ${styles.ctaLink}`}
								>
									{t('auth.loginTitle')}
								</Link>
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
