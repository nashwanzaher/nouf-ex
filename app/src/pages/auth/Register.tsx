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
		if (!email.trim()) errs.email = isRTL ? 'هذا الحقل مطلوب' : 'This field is required';
		else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
			errs.email = isRTL ? 'بريد إلكتروني غير صالح' : 'Invalid email';
		if (!password.trim()) errs.password = isRTL ? 'هذا الحقل مطلوب' : 'This field is required';
		else if (password.length < 6)
			errs.password = isRTL ? '٦ أحرف على الأقل' : 'At least 6 characters';
		if (password !== confirmPassword)
			errs.confirmPassword = isRTL ? 'كلمات المرور غير متطابقة' : 'Passwords do not match';
		if (!terms) errs.terms = isRTL ? 'يجب الموافقة على الشروط' : 'You must agree to the terms';
		setErrors(errs);
		return Object.keys(errs).length === 0;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!validate()) return;
		setIsLoading(true);
		try {
			// The server always creates a 'customer' account (it is the only
			// self-service role). The buyer/seller split is captured later in
			// the merchant onboarding flow.
			const result = await register({
				email: email.trim(),
				password,
				name: email.trim().split('@')[0] || email.trim(),
			});
			const authUser = {
				id: String(result.user.id),
				name: result.user.full_name,
				email: result.user.email,
				role: (result.user.role as 'customer' | 'merchant' | 'admin' | 'guest') || 'customer',
				avatar: result.user.avatar ?? undefined,
			};
			authLogin(authUser, result.token);
			addToast({
				message: isRTL ? 'تم إنشاء حسابك بنجاح' : 'Account created successfully',
				type: 'success',
			});
			navigate('/customer', { replace: true });
		} catch (err) {
			const message =
				err instanceof ApiError
					? err.message
					: isRTL
						? 'تعذّر إنشاء الحساب. حاول مرة أخرى.'
						: 'Could not create the account. Please try again.';
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
				<div
					className="absolute top-10 right-10 w-64 h-64 rounded-full opacity-20"
					style={{ background: '#FF6A00' }}
				/>
				<div
					className="absolute bottom-20 left-10 w-48 h-48 rounded-full opacity-15"
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
							? 'انضم إلى أكبر منصة تجارة إلكترونية في المنطقة'
							: 'Join the largest e-commerce platform in the region'}
					</p>

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

			{/* Right Panel — Register Form */}
			<div className="flex-1 flex flex-col overflow-y-auto" style={{ background: '#F0F2F5' }}>
				<div className="flex-1 flex items-center justify-center p-6 lg:p-12">
					<div className="w-full max-w-[440px] mx-auto">
						<div className="bg-white rounded shadow-sm p-6 lg:p-8">
							{/* Header */}
							<div className="mb-6 text-center">
								<h1 className="text-2xl font-bold mb-2" style={{ color: '#333' }}>
									{t('auth.registerTitle')}
								</h1>
								<p className="text-sm" style={{ color: '#666' }}>
									{isRTL ? 'أنشئ حسابك وابدأ رحلتك' : 'Create your account and start your journey'}
								</p>
							</div>

							{/* Account Type */}
							<div className="grid grid-cols-2 gap-3 mb-5">
								<button
									type="button"
									onClick={() => setAccountType('buyer')}
									className="flex flex-col items-center gap-2 p-4 rounded border-2 transition-all duration-200"
									style={{
										borderColor: accountType === 'buyer' ? '#FF6A00' : '#E5E5E5',
										background: accountType === 'buyer' ? '#FFF5EB' : 'white',
									}}>
									<ShoppingBag
										className="w-6 h-6"
										style={{ color: accountType === 'buyer' ? '#FF6A00' : '#999' }}
										strokeWidth={1.5}
									/>
									<span className="text-sm font-semibold" style={{ color: '#333' }}>
										{isRTL ? 'مشتري' : 'Buyer'}
									</span>
								</button>
								<button
									type="button"
									onClick={() => setAccountType('seller')}
									className="flex flex-col items-center gap-2 p-4 rounded border-2 transition-all duration-200"
									style={{
										borderColor: accountType === 'seller' ? '#FF6A00' : '#E5E5E5',
										background: accountType === 'seller' ? '#FFF5EB' : 'white',
									}}>
									<Store
										className="w-6 h-6"
										style={{ color: accountType === 'seller' ? '#FF6A00' : '#999' }}
										strokeWidth={1.5}
									/>
									<span className="text-sm font-semibold" style={{ color: '#333' }}>
										{isRTL ? 'بائع' : 'Seller'}
									</span>
								</button>
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
								{/* Email */}
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
											type="email"
											value={email}
											onChange={(e) => {
												setEmail(e.target.value);
												setErrors((p) => ({ ...p, email: '' }));
											}}
											placeholder={isRTL ? 'your@email.com' : 'your@email.com'}
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

								{/* Confirm Password */}
								<div>
									<Label className="text-sm font-medium mb-1.5 block" style={{ color: '#333' }}>
										{t('auth.confirmPassword')}
									</Label>
									<div className="relative">
										<Lock
											className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 ${isRTL ? 'right-3' : 'left-3'}`}
											style={{ color: '#999' }}
											strokeWidth={1.5}
										/>
										<Input
											type={showConfirm ? 'text' : 'password'}
											value={confirmPassword}
											onChange={(e) => {
												setConfirmPassword(e.target.value);
												setErrors((p) => ({ ...p, confirmPassword: '' }));
											}}
											placeholder={isRTL ? 'تأكيد كلمة المرور' : 'Confirm password'}
											className={`${isRTL ? 'pr-10 pl-10' : 'pl-10 pr-10'} h-12 text-sm rounded`}
											style={{ borderColor: errors.confirmPassword ? '#F44336' : '#E5E5E5' }}
										/>
										<button
											type="button"
											onClick={() => setShowConfirm(!showConfirm)}
											className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'left-3' : 'right-3'}`}
											style={{ color: '#999' }}>
											{showConfirm ? (
												<EyeOff className="w-5 h-5" strokeWidth={1.5} />
											) : (
												<Eye className="w-5 h-5" strokeWidth={1.5} />
											)}
										</button>
									</div>
									{errors.confirmPassword && (
										<p className="text-xs mt-1" style={{ color: '#F44336' }}>
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
										className="flex items-start gap-2 text-left w-full">
										<div
											className="w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors"
											style={{
												borderColor: terms ? '#FF6A00' : '#E5E5E5',
												background: terms ? '#FF6A00' : 'transparent',
											}}>
											{terms && <Check className="w-3 h-3 text-white" strokeWidth={2} />}
										</div>
										<span className="text-xs leading-relaxed" style={{ color: '#666' }}>
											{isRTL
												? 'أوافق على شروط الخدمة وسياسة الخصوصية'
												: 'I agree to the Terms of Service and Privacy Policy'}
										</span>
									</button>
									{errors.terms && (
										<p className="text-xs mt-1" style={{ color: '#F44336' }}>
											{errors.terms}
										</p>
									)}
								</div>

								{/* Submit */}
								<Button
									type="submit"
									disabled={isLoading}
									className="w-full h-12 text-white font-bold text-base rounded transition-colors hover:opacity-90"
									style={{ background: '#FF6A00', borderColor: '#FF6A00' }}>
									{isLoading ? (
										<div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
									) : (
										t('auth.registerBtn')
									)}
								</Button>
							</form>

							{/* Switch to login */}
							<p className="mt-6 text-center text-sm" style={{ color: '#666' }}>
								{t('auth.haveAccount')}{' '}
								<Link
									to="/auth/login"
									className="font-semibold hover:underline"
									style={{ color: '#FF6A00' }}>
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
