import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Mail, CheckCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthLayout from './AuthLayout';

export default function ForgotPassword() {
	const { t } = useTranslation();
	const [email, setEmail] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [submitted, setSubmitted] = useState(false);
	const [error, setError] = useState('');
	const [countdown, setCountdown] = useState(60);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

	// Clean up interval on unmount
	useEffect(() => {
		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
		};
	}, []);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');
		if (!email.trim()) {
			setError(t('authCommon.fieldRequired', 'This field is required'));
			return;
		}
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			setError(t('authCommon.invalidEmail', 'Invalid email'));
			return;
		}
		setIsLoading(true);
		await new Promise((r) => setTimeout(r, 1500));
		setIsLoading(false);
		setSubmitted(true);

		// Start countdown
		let seconds = 60;
		if (timerRef.current) clearInterval(timerRef.current);
		timerRef.current = setInterval(() => {
			seconds--;
			setCountdown(seconds);
			if (seconds <= 0) {
				clearInterval(timerRef.current!);
				timerRef.current = null;
			}
		}, 1000);
	};

	const handleResend = async () => {
		setCountdown(60);
		setIsLoading(true);
		await new Promise((r) => setTimeout(r, 1000));
		setIsLoading(false);
		let seconds = 60;
		if (timerRef.current) clearInterval(timerRef.current);
		timerRef.current = setInterval(() => {
			seconds--;
			setCountdown(seconds);
			if (seconds <= 0) {
				clearInterval(timerRef.current!);
				timerRef.current = null;
			}
		}, 1000);
	};

	return (
		<AuthLayout backLink="/auth/login" backLabel={t('authForgot.backToLogin', 'Back to login')}>
			<div className="animate-in slide-in-from-left-4 duration-500">
				{!submitted ? (
					<>
						{/* Header */}
						<div className="mb-8">
							<h1 className="text-3xl font-amiri font-bold text-[#1A1612] mb-2">
								{t('authForgot.title', 'Recover password')}
							</h1>
							<p className="text-[#6B6B6B] font-cairo text-sm leading-relaxed">
								{t(
									'authForgot.subtitle',
									"Enter your email and we'll send you a reset link",
								)}
							</p>
						</div>

						<form onSubmit={handleSubmit} className="space-y-5">
							<div>
								<Label className="font-cairo text-sm text-[#111111]">
									{t('authForgot.emailLabel', 'Email')}
								</Label>
								<div className="relative mt-1.5">
									<Mail
										className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#AAAAAA]"
										strokeWidth={1.5}
									/>
									<Input
										type="email"
										value={email}
										onChange={(e) => {
											setEmail(e.target.value);
											setError('');
										}}
										placeholder={t('authForgot.emailPlaceholder', 'Your email')}
										className={`pr-10 rounded-xl h-12 font-cairo text-sm ${error ? 'border-[#EF4444]' : ''}`}
									/>
								</div>
								{error && (
									<p className="text-[#EF4444] text-xs font-cairo mt-1">
										{error}
									</p>
								)}
							</div>

							<Button
								type="submit"
								disabled={isLoading}
								className="w-full h-[52px] bg-[#D4A853] text-[#1A1612] hover:bg-[#c49a48] font-cairo font-bold text-base rounded-xl transition-transform active:scale-[0.98]"
							>
								{isLoading ? (
									<div className="w-5 h-5 border-2 border-[#1A1612] border-t-transparent rounded-full animate-spin" />
								) : (
									t('authForgot.sendButton', 'Send reset link')
								)}
							</Button>
						</form>
					</>
				) : (
					/* Success State */
					<div className="text-center animate-in zoom-in-95 duration-300">
						<div className="w-20 h-20 bg-[#10B981]/10 rounded-full flex items-center justify-center mx-auto mb-6">
							<CheckCircle className="w-10 h-10 text-[#10B981]" strokeWidth={1.5} />
						</div>
						<h2 className="text-2xl font-amiri font-bold text-[#1A1612] mb-3">
							{t('authForgot.sentTitle', 'Sent!')}
						</h2>
						<p className="text-[#6B6B6B] font-cairo text-sm leading-relaxed mb-2">
							{t('authForgot.sentSubtitle', 'Check your email')}
						</p>
						<p className="text-xs text-[#AAAAAA] font-cairo mb-8">
							{t(
								'authForgot.sentTo',
								"We've sent the password reset link to {email}",
								{
									email,
								},
							)}
						</p>

						<div className="space-y-4">
							{countdown > 0 ? (
								<p className="text-sm text-[#AAAAAA] font-cairo">
									{t('authForgot.resendIn', 'Resend in {seconds} seconds', {
										seconds: countdown,
									})}
								</p>
							) : (
								<Button
									onClick={handleResend}
									disabled={isLoading}
									variant="ghost"
									className="text-[#D4A853] font-cairo font-semibold hover:text-[#c49a48] hover:bg-[#F3EDE4] rounded-xl"
								>
									{isLoading ? (
										<div className="w-4 h-4 border-2 border-[#D4A853] border-t-transparent rounded-full animate-spin" />
									) : (
										t('authForgot.resend', 'Resend')
									)}
								</Button>
							)}

							<div>
								<Link
									to="/auth/login"
									className="inline-flex items-center gap-1 text-sm text-[#D4A853] font-cairo hover:underline"
								>
									<ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
									{t('authForgot.backToLogin', 'Back to login')}
								</Link>
							</div>
						</div>
					</div>
				)}

				{/* Back to login (shown only in form state) */}
				{!submitted && (
					<div className="mt-8 text-center">
						<Link
							to="/auth/login"
							className="inline-flex items-center gap-1 text-sm text-[#D4A853] font-cairo hover:underline"
						>
							<ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
							{t('authForgot.backToLogin', 'Back to login')}
						</Link>
					</div>
				)}
			</div>
		</AuthLayout>
	);
}
