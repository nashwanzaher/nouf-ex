import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Mail, Lock, Eye, EyeOff, Globe, Shield, TrendingUp, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/context/AppContext';
import { login, ApiError } from '@/lib/api';

export default function Login() {
	const { t, i18n } = useTranslation();
	const isRTL = i18n.language === 'ar';
	const navigate = useNavigate();
	const location = useLocation();
	const { login: authLogin, addToast } = useAuth();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});

	const validate = () => {
		const errs: Record<string, string> = {};
		if (!email.trim()) errs.email = isRTL ? 'هذا الحقل مطلوب' : 'This field is required';
		if (!password.trim()) errs.password = isRTL ? 'هذا الحقل مطلوب' : 'This field is required';
		else if (password.length < 6)
			errs.password = isRTL
				? 'كلمة المرور يجب أن تكون ٦ أحرف على الأقل'
				: 'Password must be at least 6 characters';
		setErrors(errs);
		return Object.keys(errs).length === 0;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!validate()) return;
		setIsLoading(true);
		try {
			const result = await login({ email: email.trim(), password });
			// Map the API `User` shape to the AppContext `User` shape (id is
			// already a number on the server, and the context uses a string).
			const authUser = {
				id: String(result.user.id),
				name: result.user.full_name,
				email: result.user.email,
				role: (result.user.role as 'customer' | 'merchant' | 'admin' | 'guest') || 'customer',
				avatar: result.user.avatar ?? undefined,
			};
			// authLogin is async (P0-1: it syncs the local cart to the
			// server). We await it so the cart-sync toast appears
			// before the navigation completes, but we don't block the
			// "signed in" toast — that's the more important signal.
			await authLogin(authUser, result.token);
			addToast({
				message: isRTL ? 'تم تسجيل الدخول بنجاح' : 'Signed in successfully',
				type: 'success',
			});
			// Send the user to where they came from, or to the customer dashboard.
			const from = (location.state as { from?: string } | null)?.from ?? '/customer';
			navigate(from, { replace: true });
		} catch (err) {
			const message =
				err instanceof ApiError
					? err.message
					: isRTL
						? 'تعذّر تسجيل الدخول. حاول مرة أخرى.'
						: 'Could not sign in. Please try again.';
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
				className="hidden lg:flex lg:w-[45%] relative flex-col items-center justify-center p-12 overflow-hidden"
				style={{ background: 'linear-gradient(135deg, #FFF5EB 0%, #FFE4CC 40%, #FFD4B3 100%)' }}>
				{/* Decorative circles */}
				<div
					className="absolute top-10 right-10 w-64 h-64 rounded-full opacity-20"
					style={{ background: '#FF6A00' }}
				/>
				<div
					className="absolute bottom-20 left-10 w-48 h-48 rounded-full opacity-15"
					style={{ background: '#FF6A00' }}
				/>
				<div
					className="absolute top-1/3 left-1/4 w-32 h-32 rounded-full opacity-10"
					style={{ background: '#FF6A00' }}
				/>

				<div className="relative z-10 text-center max-w-md mx-auto">
					<div className="mb-8">
						<div
							className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
							style={{ background: '#FF6A00' }}>
							<Globe className="w-10 h-10 text-white" strokeWidth={1.5} />
						</div>
					</div>

					<h1 className="text-3xl xl:text-4xl font-bold mb-4" style={{ color: '#333' }}>
						{isRTL ? 'نوف إكس' : 'Nouf-ex'}
					</h1>
					<p className="text-lg xl:text-xl mb-8 leading-relaxed" style={{ color: '#666' }}>
						{isRTL
							? 'بوابتك للتجارة في الشرق الأوسط وشمال أفريقيا'
							: 'Your Gateway to MENA Commerce'}
					</p>

					{/* Hero stats */}
					<div className="grid grid-cols-3 gap-4 mb-8">
						{[
							{ icon: Users, label: isRTL ? '10K+ تاجر' : '10K+ Sellers', color: '#FF6A00' },
							{
								icon: TrendingUp,
								label: isRTL ? '500K+ منتج' : '500K+ Products',
								color: '#1688C9',
							},
							{ icon: Shield, label: isRTL ? 'دفع آمن' : 'Secure Payment', color: '#4CAF50' },
						].map((stat, i) => (
							<div
								key={i}
								className="flex flex-col items-center gap-2 p-4 rounded-xl"
								style={{ background: 'rgba(255,255,255,0.7)' }}>
								<stat.icon className="w-6 h-6" style={{ color: stat.color }} strokeWidth={1.5} />
								<span className="text-xs font-semibold" style={{ color: '#333' }}>
									{stat.label}
								</span>
							</div>
						))}
					</div>

					<Link
						to="/"
						className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-white font-semibold text-sm transition-colors hover:opacity-90"
						style={{ background: '#FF6A00' }}>
						{isRTL ? 'اكتشف المزيد' : 'View More'}
						<TrendingUp className="w-4 h-4" strokeWidth={1.5} />
					</Link>
				</div>
			</div>

			{/* Right Panel — Login Form */}
			<div className="flex-1 flex flex-col overflow-y-auto" style={{ background: '#F0F2F5' }}>
				<div className="flex-1 flex items-center justify-center p-6 lg:p-12">
					<div className="w-full max-w-[440px] mx-auto">
						{/* Card */}
						<div className="bg-white rounded shadow-sm p-6 lg:p-8">
							{/* Header */}
							<div className="mb-6 text-center">
								<h1 className="text-2xl font-bold mb-2" style={{ color: '#333' }}>
									{t('auth.loginTitle')}
								</h1>
								<p className="text-sm" style={{ color: '#666' }}>
									{isRTL ? 'أهلاً بك مجدداً في نوف إكس' : 'Welcome back to Nouf-ex'}
								</p>
							</div>

							<form onSubmit={handleSubmit} className="space-y-4">
								{errors.form && (
									<div
										role="alert"
										className="text-sm p-3 rounded"
										style={{ background: '#FDECEA', color: '#B71C1C' }}>
										{errors.form}
									</div>
								)}
								{/* Account */}
								<div>
									<Label className="text-sm font-medium mb-1.5 block" style={{ color: '#333' }}>
										{t('auth.email')}
									</Label>
									<div className="relative">
										<Mail
											className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 ${isRTL ? 'right-3' : 'left-3'}`}
											style={{ color: '#999' }}
											strokeWidth={1.5}
										/>
										<Input
											type="text"
											value={email}
											onChange={(e) => {
												setEmail(e.target.value);
												setErrors((p) => ({ ...p, email: '' }));
											}}
											placeholder={
												isRTL ? 'بريدك الإلكتروني أو رقم الهاتف' : 'Your email or phone number'
											}
											className={`${isRTL ? 'pr-10' : 'pl-10'} h-12 text-sm rounded`}
											style={{ borderColor: errors.email ? '#F44336' : '#E5E5E5' }}
										/>
									</div>
									{errors.email && (
										<p className="text-xs mt-1" style={{ color: '#F44336' }}>
											{errors.email}
										</p>
									)}
								</div>

								{/* Password */}
								<div>
									<Label className="text-sm font-medium mb-1.5 block" style={{ color: '#333' }}>
										{t('auth.password')}
									</Label>
									<div className="relative">
										<Lock
											className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 ${isRTL ? 'right-3' : 'left-3'}`}
											style={{ color: '#999' }}
											strokeWidth={1.5}
										/>
										<Input
											type={showPassword ? 'text' : 'password'}
											value={password}
											onChange={(e) => {
												setPassword(e.target.value);
												setErrors((p) => ({ ...p, password: '' }));
											}}
											placeholder={isRTL ? 'كلمة المرور' : 'Password'}
											className={`${isRTL ? 'pr-10 pl-10' : 'pl-10 pr-10'} h-12 text-sm rounded`}
											style={{ borderColor: errors.password ? '#F44336' : '#E5E5E5' }}
										/>
										<button
											type="button"
											onClick={() => setShowPassword(!showPassword)}
											className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'left-3' : 'right-3'}`}
											style={{ color: '#999' }}>
											{showPassword ? (
												<EyeOff className="w-5 h-5" strokeWidth={1.5} />
											) : (
												<Eye className="w-5 h-5" strokeWidth={1.5} />
											)}
										</button>
									</div>
									{errors.password && (
										<p className="text-xs mt-1" style={{ color: '#F44336' }}>
											{errors.password}
										</p>
									)}
								</div>

								{/* Forgot password */}
								<div className="flex justify-end">
									<Link
										to="/auth/forgot-password"
										className="text-sm hover:underline"
										style={{ color: '#1688C9' }}>
										{t('auth.forgotPassword')}
									</Link>
								</div>

								{/* Sign In Button */}
								<Button
									type="submit"
									disabled={isLoading}
									className="w-full h-12 text-white font-bold text-base rounded transition-colors hover:opacity-90"
									style={{ background: '#FF6A00', borderColor: '#FF6A00' }}>
									{isLoading ? (
										<div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
									) : (
										t('auth.loginBtn')
									)}
								</Button>
							</form>

							{/* Mobile sign in link */}
							<div className="mt-4 text-center">
								<button
									type="button"
									className="text-sm hover:underline"
									style={{ color: '#1688C9' }}>
									{isRTL ? 'تسجيل الدخول برقم الجوال' : 'Mobile number sign in'}
								</button>
							</div>

							{/* Social Login */}
							<div className="mt-6">
								<div className="relative mb-4">
									<div className="absolute inset-0 flex items-center">
										<Separator className="w-full" style={{ background: '#E5E5E5' }} />
									</div>
									<div className="relative flex justify-center">
										<span className="bg-white px-4 text-xs" style={{ color: '#999' }}>
											{isRTL ? 'أو سجل دخول باستخدام' : 'Sign in with'}
										</span>
									</div>
								</div>

								<div className="flex gap-3">
									<button
										className="flex-1 h-11 flex items-center justify-center gap-2 rounded border hover:bg-gray-50 transition-colors text-sm"
										style={{ borderColor: '#E5E5E5', color: '#333' }}>
										<svg className="w-5 h-5" viewBox="0 0 24 24">
											<path
												d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
												fill="#4285F4"
											/>
											<path
												d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
												fill="#34A853"
											/>
											<path
												d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
												fill="#FBBC05"
											/>
											<path
												d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
												fill="#EA4335"
											/>
										</svg>
										Google
									</button>
									<button
										className="flex-1 h-11 flex items-center justify-center gap-2 rounded border hover:bg-gray-50 transition-colors text-sm"
										style={{ borderColor: '#E5E5E5', color: '#333' }}>
										<svg className="w-5 h-5" viewBox="0 0 24 24" fill="#111111">
											<path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.92.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
										</svg>
										Apple
									</button>
								</div>
							</div>

							{/* Create account */}
							<p className="mt-6 text-center text-sm" style={{ color: '#666' }}>
								{isRTL ? 'مستخدم جديد؟' : 'New user?'}{' '}
								<Link
									to="/auth/register"
									className="font-semibold hover:underline"
									style={{ color: '#FF6A00' }}>
									{t('auth.registerTitle')}
								</Link>
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
