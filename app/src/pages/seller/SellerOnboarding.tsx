/**
 * SellerOnboarding — G10 fix 2026-07-11.
 *
 * The seller dashboard expects a `stores` row keyed by
 * `owner_id = req.user.id`. Until that row exists, every seller API
 * call returns 404 ("You do not have a store yet").
 *
 * This page is the missing first step of the seller onboarding
 * chain:
 *   1. POST /api/auth/register with `role='merchant'`  (Register.tsx)
 *   2. → navigate('/seller/onboarding')               (Register.tsx)
 *   3. POST /api/seller/stores with name/governorate   (this page)
 *   4. → navigate('/seller')                          (this page)
 *
 * The same page is also reachable from any signed-in merchant via
 * the dashboard shell "Create store" entry point — useful when a
 * merchant upgrades from a customer account.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
	AlertCircle,
	CheckCircle2,
	Loader2,
	MapPin,
	Store as StoreIcon,
	Type,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { useApp } from '@/context/AppContext';
import { createSellerStore, getSellerStoreMe, ApiError } from '@/lib/api';
import type { SellerStoreCreate } from '@/lib/api';

const YEMENI_GOVERNORATES = [
	'صنعاء',
	'عدن',
	'تعز',
	'الحديدة',
	'إب',
	'المحويت',
	'ذمار',
	'البيضاء',
	'مأرب',
	'الجوف',
	'عمران',
	'صعدة',
	'حجة',
	'ريمة',
	'الضالع',
	'لحج',
	'أبين',
	'شبوة',
	'المهرة',
	'حضرموت',
	'سقطرى',
];

export default function SellerOnboarding() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { addToast } = useApp();
	const [checkingStore, setCheckingStore] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [storeName, setStoreName] = useState('');
	const [city, setCity] = useState('');
	const [governorate, setGovernorate] = useState('');
	const [description, setDescription] = useState('');

	// First check whether the merchant already has a store — if so,
	// jump straight to the dashboard instead of making them fill
	// the form out again.
	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				await getSellerStoreMe();
				if (!cancelled) navigate('/seller', { replace: true });
			} catch {
				// 404 / 401 — no store yet, or the user is not a
				// merchant. Either way, render the form.
				if (!cancelled) setCheckingStore(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [navigate]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		if (storeName.trim().length < 2) {
			setError(t('seller.onboarding.nameRequired', 'Store name is required.'));
			return;
		}
		setSaving(true);
		try {
			const body: SellerStoreCreate = {
				store_name: storeName.trim(),
				city: city.trim() || undefined,
				governorate: governorate.trim() || undefined,
				description: description.trim() || undefined,
			};
			await createSellerStore(body);
			addToast({
				message: t(
					'seller.onboarding.created',
					'Your store is live. Welcome aboard!',
				),
				type: 'success',
			});
			navigate('/seller', { replace: true });
		} catch (err) {
			const message =
				err instanceof ApiError
					? err.message
					: t(
							'seller.onboarding.error',
							'Could not create your store. Please try again.',
						);
			setError(message);
		} finally {
			setSaving(false);
		}
	};

	if (checkingStore) {
		return (
			<div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
				<Loader2 className="w-8 h-8 text-aliOrange animate-spin mb-3" />
				<p className="text-sm text-aliTextSec">
					{t('seller.onboarding.checking', 'Checking your store status…')}
				</p>
			</div>
		);
	}

	return (
		<div className="min-h-[100dvh] bg-aliSurface py-10 px-4" dir="rtl">
			<div className="max-w-2xl mx-auto">
				<header className="text-center mb-6">
					<div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-aliOrange/10 text-aliOrange mb-4">
						<StoreIcon className="w-8 h-8" strokeWidth={1.5} />
					</div>
					<h1 className="text-2xl font-bold text-aliText mb-2">
						{t('seller.onboarding.title', 'Open your store')}
					</h1>
					<p className="text-sm text-aliTextSec">
						{t(
							'seller.onboarding.subtitle',
							'Tell us about your store so customers can find you. You can change every detail later.',
						)}
					</p>
				</header>

				<Card className="border-0 shadow-sm">
					<CardContent className="p-6">
						{error && (
							<div
								role="alert"
								className="flex items-start gap-2 text-sm p-3 rounded mb-4 bg-red-50 text-red-700 border border-red-200"
							>
								<AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
								<span>{error}</span>
							</div>
						)}

						<form onSubmit={handleSubmit} className="space-y-4">
							<div>
								<Label htmlFor="store_name" className="text-sm font-medium mb-1.5 block">
									{t('seller.onboarding.name', 'Store name')}
								</Label>
								<div className="relative">
									<Type
										className="absolute top-1/2 -translate-y-1/2 w-4 h-4 text-aliTextMute"
										style={{ insetInlineStart: '12px' }}
										strokeWidth={1.5}
									/>
									<Input
										id="store_name"
										value={storeName}
										onChange={(e) => {
											setStoreName(e.target.value);
											setError(null);
										}}
										placeholder={t('seller.onboarding.namePlaceholder', 'e.g. Yemen Coffee Roasters')}
										className="h-12"
										style={{ paddingInlineStart: '36px' }}
										autoFocus
										minLength={2}
										maxLength={100}
										required
									/>
								</div>
							</div>

							<div className="grid sm:grid-cols-2 gap-4">
								<div>
									<Label htmlFor="governorate" className="text-sm font-medium mb-1.5 block">
										{t('seller.onboarding.governorate', 'Governorate')}
									</Label>
									<div className="relative">
										<MapPin
											className="absolute top-1/2 -translate-y-1/2 w-4 h-4 text-aliTextMute pointer-events-none"
											style={{ insetInlineStart: '12px' }}
											strokeWidth={1.5}
										/>
										<select
											id="governorate"
											value={governorate}
											onChange={(e) => setGovernorate(e.target.value)}
											className="w-full h-12 rounded-md border border-input bg-background px-3 text-sm font-cairo"
											style={{ paddingInlineStart: '36px' }}
										>
											<option value="">
												{t('seller.onboarding.selectGov', 'Select…')}
											</option>
											{YEMENI_GOVERNORATES.map((g) => (
												<option key={g} value={g}>
													{g}
												</option>
											))}
										</select>
									</div>
								</div>
								<div>
									<Label htmlFor="city" className="text-sm font-medium mb-1.5 block">
										{t('seller.onboarding.city', 'City')}
									</Label>
									<Input
										id="city"
										value={city}
										onChange={(e) => setCity(e.target.value)}
										placeholder={t('seller.onboarding.cityPlaceholder', 'e.g. Sana’a')}
										className="h-12"
										maxLength={50}
									/>
								</div>
							</div>

							<div>
								<Label htmlFor="description" className="text-sm font-medium mb-1.5 block">
									{t('seller.onboarding.description', 'About your store (optional)')}
								</Label>
								<Textarea
									id="description"
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									placeholder={t(
										'seller.onboarding.descriptionPlaceholder',
										'Tell customers what makes your store special.',
									)}
									rows={3}
									maxLength={4000}
								/>
							</div>

							<div className="rounded-lg bg-aliSurface/60 p-3 text-xs text-aliTextSec flex items-start gap-2">
								<CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
								<span>
									{t(
										'seller.onboarding.hint',
										'Your store will be active immediately. Products can be added from the dashboard.',
									)}
								</span>
							</div>

							<Button
								type="submit"
								disabled={saving}
								className="w-full h-12 bg-aliOrange hover:bg-aliOrangeHover text-white font-bold"
							>
								{saving ? (
									<Loader2 className="w-5 h-5 animate-spin me-2" />
								) : (
									<StoreIcon className="w-4 h-4 me-2" />
								)}
								{saving
									? t('seller.onboarding.submitting', 'Creating store…')
									: t('seller.onboarding.submit', 'Create store')}
							</Button>
						</form>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}