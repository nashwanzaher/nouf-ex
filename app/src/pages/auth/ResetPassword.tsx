import { useState } from 'react';
import { Link } from 'react-router';
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthLayout from './AuthLayout';

function PasswordStrength({ password }: { password: string }) {
	let score = 0;
	if (password.length >= 8) score++;
	if (/[A-Z]/.test(password)) score++;
	if (/[a-z]/.test(password)) score++;
	if (/[0-9]/.test(password)) score++;
	if (/[^A-Za-z0-9]/.test(password)) score++;

	const labels = ['ضعيف', 'متوسط', 'جيد', 'قوي', 'ممتاز'];
	const colors = ['bg-[#EF4444]', 'bg-[#F59E0B]', 'bg-[#D4A853]', 'bg-[#10B981]', 'bg-[#2563EB]'];
	const textColors = [
		'text-[#EF4444]',
		'text-[#F59E0B]',
		'text-[#D4A853]',
		'text-[#10B981]',
		'text-[#2563EB]',
	];

	if (password.length === 0) return null;

	const idx = Math.min(score, 4);

	return (
		<div className="mt-2">
			<div className="flex gap-1 mb-1">
				{[1, 2, 3, 4, 5].map((i) => (
					<div
						key={i}
						className={`h-1 flex-1 rounded-full transition-colors ${i <= score ? colors[idx] : 'bg-[#F3EDE4]'}`}
					/>
				))}
			</div>
			<p className={`text-[10px] font-cairo ${textColors[idx]}`}>{labels[idx]}</p>
		</div>
	);
}

export default function ResetPassword() {
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});

	const validate = () => {
		const errs: Record<string, string> = {};
		if (!password.trim()) errs.password = 'هذا الحقل مطلوب';
		else if (password.length < 6) errs.password = 'كلمة المرور يجب أن تكون ٦ أحرف على الأقل';
		if (password !== confirmPassword) errs.confirmPassword = 'كلمات المرور غير متطابقة';
		setErrors(errs);
		return Object.keys(errs).length === 0;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!validate()) return;
		setIsLoading(true);
		await new Promise((r) => setTimeout(r, 1500));
		setIsLoading(false);
		setSuccess(true);
	};

	if (success) {
		return (
			<AuthLayout showBackLink={false}>
				<div className="animate-in zoom-in-95 duration-300 text-center">
					<div className="w-20 h-20 bg-[#10B981]/10 rounded-full flex items-center justify-center mx-auto mb-6">
						<CheckCircle className="w-10 h-10 text-[#10B981]" strokeWidth={1.5} />
					</div>
					<h2 className="text-2xl font-amiri font-bold text-[#1A1612] mb-3">
						تم تغيير كلمة المرور!
					</h2>
					<p className="text-[#6B6B6B] font-cairo text-sm leading-relaxed mb-8">
						تم تحديث كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول باستخدام كلمة المرور
						الجديدة.
					</p>
					<Link to="/auth/login">
						<Button className="w-full h-[52px] bg-[#D4A853] text-[#1A1612] hover:bg-[#c49a48] font-cairo font-bold text-base rounded-xl transition-transform active:scale-[0.98]">
							تسجيل الدخول
						</Button>
					</Link>
				</div>
			</AuthLayout>
		);
	}

	return (
		<AuthLayout backLink="/auth/forgot-password" backLabel="العودة">
			<div className="animate-in slide-in-from-left-4 duration-500">
				{/* Header */}
				<div className="mb-8">
					<h1 className="text-3xl font-amiri font-bold text-[#1A1612] mb-2">
						تعيين كلمة مرور جديدة
					</h1>
					<p className="text-[#6B6B6B] font-cairo text-sm">
						أدخل كلمة المرور الجديدة أدناه
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-5">
					{/* New Password */}
					<div>
						<Label className="font-cairo text-sm text-[#111111]">
							كلمة المرور الجديدة
						</Label>
						<div className="relative mt-1.5">
							<Lock
								className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#AAAAAA]"
								strokeWidth={1.5}
							/>
							<Input
								type={showPassword ? 'text' : 'password'}
								value={password}
								onChange={(e) => {
									setPassword(e.target.value);
									setErrors((p) => ({ ...p, password: '' }));
								}}
								placeholder="كلمة المرور الجديدة"
								className={`pr-10 pl-10 rounded-xl h-12 font-cairo text-sm ${errors.password ? 'border-[#EF4444]' : ''}`}
							/>
							<button
								type="button"
								onClick={() => setShowPassword(!showPassword)}
								className="absolute left-3 top-1/2 -translate-y-1/2 text-[#AAAAAA] hover:text-[#6B6B6B]"
							>
								{showPassword ? (
									<EyeOff className="w-5 h-5" strokeWidth={1.5} />
								) : (
									<Eye className="w-5 h-5" strokeWidth={1.5} />
								)}
							</button>
						</div>
						<PasswordStrength password={password} />
						{errors.password && (
							<p className="text-[#EF4444] text-xs font-cairo mt-1">
								{errors.password}
							</p>
						)}
					</div>

					{/* Confirm Password */}
					<div>
						<Label className="font-cairo text-sm text-[#111111]">
							تأكيد كلمة المرور
						</Label>
						<div className="relative mt-1.5">
							<Lock
								className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#AAAAAA]"
								strokeWidth={1.5}
							/>
							<Input
								type={showConfirm ? 'text' : 'password'}
								value={confirmPassword}
								onChange={(e) => {
									setConfirmPassword(e.target.value);
									setErrors((p) => ({ ...p, confirmPassword: '' }));
								}}
								placeholder="أعد إدخال كلمة المرور"
								className={`pr-10 pl-10 rounded-xl h-12 font-cairo text-sm ${errors.confirmPassword ? 'border-[#EF4444]' : ''}`}
							/>
							<button
								type="button"
								onClick={() => setShowConfirm(!showConfirm)}
								className="absolute left-3 top-1/2 -translate-y-1/2 text-[#AAAAAA] hover:text-[#6B6B6B]"
							>
								{showConfirm ? (
									<EyeOff className="w-5 h-5" strokeWidth={1.5} />
								) : (
									<Eye className="w-5 h-5" strokeWidth={1.5} />
								)}
							</button>
						</div>
						{errors.confirmPassword && (
							<p className="text-[#EF4444] text-xs font-cairo mt-1">
								{errors.confirmPassword}
							</p>
						)}
					</div>

					{/* Submit */}
					<Button
						type="submit"
						disabled={isLoading}
						className="w-full h-[52px] bg-[#D4A853] text-[#1A1612] hover:bg-[#c49a48] font-cairo font-bold text-base rounded-xl transition-transform active:scale-[0.98] mt-2"
					>
						{isLoading ? (
							<div className="w-5 h-5 border-2 border-[#1A1612] border-t-transparent rounded-full animate-spin" />
						) : (
							'تعيين كلمة المرور'
						)}
					</Button>
				</form>
			</div>
		</AuthLayout>
	);
}
