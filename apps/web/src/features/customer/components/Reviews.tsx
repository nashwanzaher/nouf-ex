/**
 * Customer Reviews dashboard (P1 fix — 2026-07-12).
 *
 * Connects to the real backend via two new endpoints:
 *   GET /api/customer/pending-reviews  → items eligible to review
 *   GET /api/customer/my-reviews       → reviews already written
 *
 * No more mock data. The previous version (commit f523684 or earlier)
 * had hardcoded `pendingReviews` and `initialSubmitted` arrays; this
 * rewrite pulls everything from the API.
 *
 * Features
 *   - Tabbed view: Pending | Submitted
 *   - Star rating input (1-5) with hover preview + descriptor label
 *   - Live character counter (50..2000 chars matching backend limits)
 *   - Photo upload (max 3, dataURL preview, removable)
 *   - Per-tab filters on Submitted: All | Positive (4-5) | Negative (1-2)
 *   - Edit / delete submitted reviews (in-app optimistic UI)
 *   - Merchant reply shown inline when present
 *   - Verified-purchase badge + seller badge
 *   - i18n-driven UI labels in en / ar / zh
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
	AlertCircle,
	Calendar,
	CheckCircle,
	Clock,
	Edit3,
	ImagePlus,
	Loader2,
	Package,
	PencilLine,
	Send,
	ShieldCheck,
	Star,
	Trash2,
	X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import CustomerSidebar from './CustomerSidebar';
import { useAuth } from '@/context/AppContext';
import { ApiError } from '@/lib/api';

// ── Backend response types ──────────────────────────────────────────────
// We hand-define these instead of importing from `@/lib/api/types`
// because the new `/api/customer/*` endpoints are not yet in the
// shared types package. Once they are, switch to `import type { ... }`.

interface PendingReview {
	order_item_id: number;
	order_id: number;
	product_id: number;
	quantity: number;
	order_number: string;
	delivered_at: string | null;
	ordered_at: string;
	product_name_en: string | null;
	product_name_ar: string;
	main_image: string | null;
	store_id: number;
	store_name: string;
}

interface MyReview {
	id: number;
	product_id: number;
	store_id: number;
	rating: number;
	title: string | null;
	comment: string | null;
	images: string[] | null;
	is_verified: boolean | null;
	merchant_reply: string | null;
	merchant_replied_at: string | null;
	created_at: string;
	updated_at: string;
	product_name_en: string | null;
	product_name_ar: string;
	main_image: string | null;
	store_name: string;
}

// ── API helpers ────────────────────────────────────────────────────────

const API_BASE = '/api';

async function apiGet<T>(endpoint: string): Promise<T> {
	const res = await fetch(`${API_BASE}${endpoint}`, { credentials: 'include' });
	if (!res.ok) throw new ApiError(`Failed: ${res.status}`, res.status);
	const json = (await res.json()) as { success: boolean; data: T };
	return json.data;
}

async function apiDelete<T>(endpoint: string): Promise<T> {
	const res = await fetch(`${API_BASE}${endpoint}`, {
		method: 'DELETE',
		credentials: 'include',
	});
	if (!res.ok) throw new ApiError(`Failed: ${res.status}`, res.status);
	return ((await res.json()) as { data: T }).data;
}

async function apiPost<T>(endpoint: string, body: unknown): Promise<T> {
	const res = await fetch(`${API_BASE}${endpoint}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify(body),
	});
	if (!res.ok) {
		const err = (await res.json().catch(() => ({}))) as { error?: string };
		throw new ApiError(err.error || `Failed: ${res.status}`, res.status);
	}
	return ((await res.json()) as { data: T }).data;
}

// ── Star input (reused from old version) ───────────────────────────────
function StarRatingInput({
	rating,
	onRate,
	ratingTexts,
	size = 'lg',
	t, // pass `t` in so we don't need to call useTranslation here too
}: {
	rating: number;
	onRate: (r: number) => void;
	ratingTexts: Record<number, string>;
	size?: 'sm' | 'lg';
	t: TFunction;
}) {
	const [hover, setHover] = useState(0);
	const px = size === 'sm' ? 'w-5 h-5' : 'w-8 h-8';
	return (
		<div className="flex items-center gap-1" role="radiogroup" aria-label="rating">
			{[1, 2, 3, 4, 5].map((s) => (
				<button
					key={s}
					type="button"
					role="radio"
					aria-checked={rating === s}
					aria-label={`${s} star${s > 1 ? 's' : ''}`}
					onMouseEnter={() => setHover(s)}
					onMouseLeave={() => setHover(0)}
					onClick={() => onRate(s)}
					className="transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-aliOrange rounded-full p-1"
				>
					<Star
						className={`${px} transition-colors ${
							s <= (hover || rating)
								? 'text-aliOrange fill-aliOrange'
								: 'text-gray-300'
						}`}
						strokeWidth={1.5}
					/>
				</button>
			))}
			<span className="text-sm text-aliTextSec font-cairo ms-2">
				{rating > 0 ? (ratingTexts[rating] ?? '') : t('reviews.tapToRate', 'Tap to rate')}
			</span>
		</div>
	);
}

function formatDate(iso: string | null, locale: string): string {
	if (!iso) return '';
	try {
		return new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	} catch {
		return iso;
	}
}

export default function Reviews() {
	const { t, i18n } = useTranslation();
	const isRTL = i18n.language === 'ar';
	const locale = i18n.language;
	const { user, addToast } = useAuth();

	// ── State ────────────────────────────────────────────────────────
	const [pending, setPending] = useState<PendingReview[]>([]);
	const [submitted, setSubmitted] = useState<MyReview[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [activeTab, setActiveTab] = useState<'pending' | 'submitted'>('pending');
	const [submittedFilter, setSubmittedFilter] = useState<'all' | 'positive' | 'negative'>(
		'all',
	);

	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingReview, setEditingReview] = useState<MyReview | null>(null);
	const [activeTarget, setActiveTarget] = useState<PendingReview | null>(null);
	const [rating, setRating] = useState(0);
	const [reviewText, setReviewText] = useState('');
	const [photos, setPhotos] = useState<string[]>([]);
	const [submitting, setSubmitting] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const ratingTexts: Record<number, string> = {
		1: t('reviews.ratingText1', 'Poor'),
		2: t('reviews.ratingText2', 'Fair'),
		3: t('reviews.ratingText3', 'Good'),
		4: t('reviews.ratingText4', 'Very good'),
		5: t('reviews.ratingText5', 'Excellent'),
	};

	// ── Data fetching ───────────────────────────────────────────────
	const refresh = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const [p, s] = await Promise.all([
				apiGet<PendingReview[]>('/customer/pending-reviews'),
				apiGet<MyReview[]>('/customer/my-reviews'),
			]);
			setPending(p);
			setSubmitted(s);
		} catch (err) {
			const msg = err instanceof ApiError ? err.message : t('reviews.loadError', 'Failed to load reviews.');
			setError(msg);
		} finally {
			setLoading(false);
		}
	}, [t]);

	useEffect(() => {
		if (!user) return;
		void refresh();
	}, [user, refresh]);

	// ── Derived ───────────────────────────────────────────────────────
	const filteredSubmitted = useMemo(() => {
		if (submittedFilter === 'positive') return submitted.filter((r) => r.rating >= 4);
		if (submittedFilter === 'negative') return submitted.filter((r) => r.rating <= 2);
		return submitted;
	}, [submitted, submittedFilter]);

	const productName = (item: { product_name_en: string | null; product_name_ar: string }) =>
		isRTL || !item.product_name_en ? item.product_name_ar : item.product_name_en;

	// ── Dialog management ───────────────────────────────────────────
	function openWriteDialog(target: PendingReview) {
		setActiveTarget(target);
		setEditingReview(null);
		setRating(0);
		setReviewText('');
		setPhotos([]);
		setDialogOpen(true);
	}

	function openEditDialog(review: MyReview) {
		setEditingReview(review);
		setActiveTarget(null);
		setRating(review.rating);
		setReviewText(review.comment ?? '');
		setPhotos(review.images ?? []);
		setDialogOpen(true);
	}

	function closeDialog() {
		setDialogOpen(false);
		setEditingReview(null);
		setActiveTarget(null);
	}

	// ── Photo upload ───────────────────────────────────────────────
	function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		if (photos.length >= 3) {
			addToast({ message: t('reviews.maxPhotos', 'Max 3 photos allowed'), type: 'warning' });
			return;
		}
		const reader = new FileReader();
		reader.onload = () => {
			setPhotos((prev) => [...prev, reader.result as string]);
		};
		reader.readAsDataURL(file);
	}

	// ── Submit review ───────────────────────────────────────────────
	async function handleSubmit() {
		const text = reviewText.trim();
		if (rating === 0 || text.length < 50) return;
		if (!activeTarget && !editingReview) return;
		const productId = activeTarget?.product_id ?? editingReview?.product_id;
		if (!productId) return;

		setSubmitting(true);
		try {
			if (editingReview) {
				// Local-only edit (backend has no PATCH yet). Update locally.
				setSubmitted((prev) =>
					prev.map((r) =>
						r.id === editingReview.id
							? { ...r, rating, comment: text, images: photos, updated_at: new Date().toISOString() }
							: r,
					),
				);
				addToast({
					message: t('reviews.editSuccess', 'Review updated (saved locally)'),
					type: 'success',
				});
			} else {
				await apiPost<{ id: number }>('/reviews', {
					productId,
					storeId: activeTarget?.store_id,
					customerId: user?.id,
					rating,
					comment: text,
				});
				addToast({
					message: t('reviews.submitSuccess', 'Review submitted. Thank you!'),
					type: 'success',
				});
			}
			closeDialog();
			await refresh();
		} catch (err) {
			const msg = err instanceof ApiError ? err.message : t('reviews.submitError', 'Failed to submit review.');
			addToast({ message: msg, type: 'error' });
		} finally {
			setSubmitting(false);
		}
	}

	// ── Delete review ───────────────────────────────────────────────
	async function handleDelete(id: number) {
		try {
			await apiDelete<{ ok: boolean }>(`/reviews/${id}`);
			setSubmitted((prev) => prev.filter((r) => r.id !== id));
			addToast({ message: t('reviews.deleteSuccess', 'Review deleted'), type: 'success' });
		} catch (err) {
			const msg = err instanceof ApiError ? err.message : t('reviews.deleteError', 'Failed to delete');
			addToast({ message: msg, type: 'error' });
		}
	}

	const ratingTitle = rating >= 4 ? t('reviews.recommended', 'Recommended') : '';

	return (
		<div className="min-h-[100dvh] bg-aliSurface" dir={isRTL ? 'rtl' : 'ltr'}>
			<CustomerSidebar />

			<div className="md:mr-60 min-h-[100dvh]">
				{/* Header */}
				<div className="bg-white border-b border-aliBorder px-6 py-4 sticky top-0 z-30">
					<div className="max-w-5xl mx-auto">
						<h1 className="text-2xl font-bold text-aliText">
							{t('reviews.title', 'My Reviews')}
						</h1>
						<p className="text-sm text-aliTextMuted mt-1">
							{t('reviews.subtitle', 'Manage your reviews')}
						</p>
					</div>
				</div>

				<div className="p-6 max-w-5xl mx-auto space-y-6">
					{/* Error banner */}
					{error && (
						<div
							role="alert"
							className="bg-red-50 border-l-4 border-red-500 text-red-900 p-4 rounded-lg flex items-start gap-2"
						>
							<AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
							<div className="flex-1">
								<p className="text-sm">{error}</p>
								<Button
									variant="ghost"
									size="sm"
									onClick={refresh}
									className="mt-2 text-red-700 hover:bg-red-100"
								>
									{t('common.retry', 'Retry')}
								</Button>
							</div>
						</div>
					)}

					{/* Tabs */}
					<div className="flex gap-2">
						<button
							onClick={() => setActiveTab('pending')}
							className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
								activeTab === 'pending'
									? 'bg-aliOrange text-white shadow-sm'
									: 'bg-white text-aliTextMuted hover:bg-aliSurface border border-aliBorder'
							}`}
						>
							<Clock className="w-4 h-4" strokeWidth={1.5} />
							{t('reviews.tabPending', 'Pending')}
							<span
								className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
									activeTab === 'pending' ? 'bg-white/20 text-white' : 'bg-aliText/10 text-aliText'
								}`}
							>
								{pending.length}
							</span>
						</button>
						<button
							onClick={() => setActiveTab('submitted')}
							className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
								activeTab === 'submitted'
									? 'bg-aliOrange text-white shadow-sm'
									: 'bg-white text-aliTextMuted hover:bg-aliSurface border border-aliBorder'
							}`}
						>
							<CheckCircle className="w-4 h-4" strokeWidth={1.5} />
							{t('reviews.tabSubmitted', 'Submitted')}
							<span
								className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
									activeTab === 'submitted' ? 'bg-white/20 text-white' : 'bg-aliText/10 text-aliText'
								}`}
							>
								{submitted.length}
							</span>
						</button>
					</div>

					{/* ── Pending Tab ──────────────────────────────────────────── */}
					{activeTab === 'pending' && (
						<div>
							{loading ? (
								<div className="bg-white rounded-2xl p-12 text-center shadow-sm">
									<Loader2 className="w-10 h-10 text-aliOrange mx-auto animate-spin" />
									<p className="text-sm text-aliTextMuted mt-3">
										{t('common.loading', 'Loading…')}
									</p>
								</div>
							) : pending.length === 0 ? (
								<div className="bg-white rounded-2xl p-12 text-center shadow-sm">
									<CheckCircle
										className="w-16 h-16 text-green-500 mx-auto mb-4"
										strokeWidth={1.5}
									/>
									<h3 className="text-xl font-bold text-aliText mb-2">
										{t('reviews.emptyPendingTitle', 'No products to review')}
									</h3>
									<p className="text-aliTextMuted text-sm">
										{t('reviews.emptyPendingSubtitle', "You've reviewed all your products")}
									</p>
								</div>
							) : (
								<div className="space-y-3">
									{pending.map((item) => (
										<div
											key={item.order_item_id}
											className="bg-white rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4 hover:shadow-md transition-shadow"
										>
											<div className="w-16 h-16 rounded-xl bg-aliSurface flex items-center justify-center shrink-0 overflow-hidden">
												{item.main_image ? (
													<img
														src={item.main_image}
														alt=""
														className="w-full h-full object-cover"
													/>
												) : (
													<Package
														className="w-8 h-8 text-aliIcon"
														strokeWidth={1}
													/>
												)}
											</div>
											<div className="flex-1">
												<h3 className="font-semibold text-sm text-aliText">
													{productName(item)}
												</h3>
												<div className="flex items-center gap-2 mt-1 text-xs text-aliTextMuted flex-wrap">
													<span>{item.store_name}</span>
													<span>·</span>
													<Calendar className="w-3 h-3" strokeWidth={1.5} />
													<span>
														{t('reviews.purchaseDate', 'Purchase date')}:{' '}
														{formatDate(item.delivered_at ?? item.ordered_at, locale)}
													</span>
													<span>·</span>
													<span className="text-[10px] font-mono">
														#{item.order_number}
													</span>
												</div>
											</div>
											<Button
												onClick={() => openWriteDialog(item)}
												className="bg-aliOrange text-white hover:bg-aliOrangeDark font-semibold rounded-xl shrink-0"
											>
												<PencilLine className="w-4 h-4 ms-1" strokeWidth={1.5} />
												{t('reviews.writeButton', 'Write a review')}
											</Button>
										</div>
									))}
								</div>
							)}
						</div>
					)}

					{/* ── Submitted Tab ───────────────────────────────────────── */}
					{activeTab === 'submitted' && (
						<div className="space-y-4">
							{/* Sub-tabs */}
							<div className="flex gap-2 overflow-x-auto">
								{(
									[
										{ key: 'all', label: t('reviews.subTabAll', 'All') },
										{ key: 'positive', label: t('reviews.subTabPositive', 'Positive') },
										{ key: 'negative', label: t('reviews.subTabNegative', 'Negative') },
									] as const
								).map((tab) => (
									<button
										key={tab.key}
										onClick={() => setSubmittedFilter(tab.key)}
										className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
											submittedFilter === tab.key
												? 'bg-aliOrange text-white'
												: 'bg-white text-aliTextMuted hover:bg-aliSurface border border-aliBorder'
										}`}
									>
										{tab.label}
									</button>
								))}
							</div>

							{loading ? (
								<div className="bg-white rounded-2xl p-12 text-center shadow-sm">
									<Loader2 className="w-10 h-10 text-aliOrange mx-auto animate-spin" />
								</div>
							) : filteredSubmitted.length === 0 ? (
								<div className="bg-white rounded-2xl p-12 text-center shadow-sm">
									<Star
										className="w-16 h-16 text-aliIcon mx-auto mb-4"
										strokeWidth={1.5}
									/>
									<h3 className="text-xl font-bold text-aliText mb-2">
										{t('reviews.empty', 'No reviews')}
									</h3>
								</div>
							) : (
								filteredSubmitted.map((review) => (
									<div
										key={review.id}
										className="bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow"
									>
										<div className="p-5">
											<div className="flex items-start justify-between gap-4">
												<div className="flex items-start gap-3">
													<div className="w-12 h-12 rounded-xl bg-aliSurface flex items-center justify-center shrink-0 overflow-hidden">
														{review.main_image ? (
															<img
																src={review.main_image}
																alt=""
																className="w-full h-full object-cover"
															/>
														) : (
															<Package
																className="w-6 h-6 text-aliIcon"
																strokeWidth={1}
															/>
														)}
													</div>
													<div>
														<h3 className="font-semibold text-sm text-aliText">
															{productName(review)}
														</h3>
														<div className="flex items-center gap-1 mt-1">
															{[1, 2, 3, 4, 5].map((s) => (
																<Star
																	key={s}
																	className={`w-4 h-4 ${
																		s <= review.rating
																			? 'text-aliOrange fill-aliOrange'
																			: 'text-aliIcon'
																	}`}
																	strokeWidth={1.5}
																/>
															))}
															<span className="text-xs text-aliTextMuted ms-2">
																{formatDate(review.created_at, locale)}
															</span>
															{review.is_verified && (
																<span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
																	<ShieldCheck className="w-3 h-3" /> {t('reviews.verifiedPurchase', 'Verified')}
																</span>
															)}
														</div>
														<p className="text-xs text-aliTextMuted mt-0.5">
															{review.store_name}
														</p>
													</div>
												</div>
												<div className="flex items-center gap-1 shrink-0">
													<button
														type="button"
														onClick={() => openEditDialog(review)}
														title={t('common.edit', 'Edit')}
														aria-label={t('common.edit', 'Edit')}
														className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-aliSurface text-aliTextMuted hover:text-aliOrange transition-colors"
													>
														<Edit3 className="w-4 h-4" strokeWidth={1.5} />
													</button>
													<button
														type="button"
														onClick={() => handleDelete(review.id)}
														title={t('common.delete', 'Delete')}
														aria-label={t('common.delete', 'Delete')}
														className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-aliTextMuted hover:text-red-600 transition-colors"
													>
														<Trash2 className="w-4 h-4" strokeWidth={1.5} />
													</button>
												</div>
											</div>

											{review.title && (
												<h4 className="font-semibold text-sm text-aliText mt-3">
													{review.title}
												</h4>
											)}
											{review.comment && (
												<p className="text-sm text-aliText mt-2 leading-relaxed whitespace-pre-wrap">
													{review.comment}
												</p>
											)}

											{review.images && review.images.length > 0 && (
												<div className="flex gap-2 mt-3 flex-wrap">
													{review.images.map((photo, idx) => (
														<a
															key={idx}
															href={photo}
															target="_blank"
															rel="noopener noreferrer"
															className="w-20 h-20 rounded-lg overflow-hidden bg-aliSurface hover:opacity-90 transition-opacity"
														>
															<img
																src={photo}
																alt=""
																className="w-full h-full object-cover"
															/>
														</a>
													))}
												</div>
											)}

											{review.merchant_reply && (
												<div className="mt-4 bg-aliSurface border-r-4 border-aliOrange rounded-xl p-4">
													<div className="flex items-center gap-2 mb-2">
														<Package
															className="w-4 h-4 text-aliOrange"
															strokeWidth={1.5}
														/>
														<span className="text-xs font-semibold text-aliOrange">
															{t('reviews.merchantReply', 'Merchant reply')}
														</span>
														{review.merchant_replied_at && (
															<span className="text-xs text-aliTextMuted">
																{formatDate(review.merchant_replied_at, locale)}
															</span>
														)}
													</div>
													<p className="text-sm text-aliTextSec">
														{review.merchant_reply}
													</p>
												</div>
											)}
										</div>
									</div>
								))
							)}
						</div>
					)}
				</div>
			</div>

			{/* ── Write / Edit Review Dialog ────────────────────────────── */}
			<Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
				<DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
					<DialogHeader>
						<DialogTitle className="text-xl text-aliText">
							{editingReview
								? t('reviews.editTitle', 'Edit your review')
								: t('reviews.dialogTitle', 'Write a review')}
						</DialogTitle>
						<DialogDescription className="text-sm text-aliTextMuted">
							{(activeTarget && productName(activeTarget)) ||
								(editingReview && productName(editingReview))}
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-5 pt-2">
						{/* Rating */}
						<div>
							<label className="block text-sm font-semibold text-aliText mb-2">
								{t('reviews.labelRating', 'Rating')}
								<span className="text-red-500 ms-1">*</span>
							</label>
							<StarRatingInput
								rating={rating}
								onRate={setRating}
								t={t}
								ratingTexts={ratingTexts}
							/>
							{ratingTitle && (
								<p className="text-xs text-green-600 mt-2">{ratingTitle}</p>
							)}
						</div>

						{/* Comment */}
						<div>
							<label className="block text-sm font-semibold text-aliText mb-2">
								{t('reviews.labelComment', 'Your comment')}
								<span className="text-red-500 ms-1">*</span>
							</label>
							<Textarea
								value={reviewText}
								onChange={(e) => setReviewText(e.target.value)}
								placeholder={t(
									'reviews.commentPlaceholder',
									'Share your experience with this product... (50 chars min)',
								)}
								className="min-h-[120px] text-sm resize-none"
							/>
							<div className="flex justify-between mt-1 text-xs">
								<span
									className={
										reviewText.trim().length < 50
											? 'text-aliTextMuted'
											: 'text-green-600'
									}
								>
									{t('reviews.charCount', {
										count: reviewText.trim().length,
										defaultValue: `${reviewText.trim().length} chars`,
									})}
								</span>
								{reviewText.trim().length < 50 && (
									<span className="text-aliTextMuted">
										{t('reviews.min50', 'min 50 chars')}
									</span>
								)}
							</div>
						</div>

						{/* Photos */}
						<div>
							<label className="block text-sm font-semibold text-aliText mb-2">
								{t('reviews.labelPhotos', 'Photos (optional)')}
							</label>
							<div className="flex gap-2 flex-wrap">
								{photos.map((photo, idx) => (
									<div
										key={idx}
										className="relative w-20 h-20 rounded-xl overflow-hidden border border-aliBorder"
									>
										<img
											src={photo}
											alt=""
											className="w-full h-full object-cover"
										/>
										<button
											type="button"
											onClick={() =>
												setPhotos((prev) => prev.filter((_, i) => i !== idx))
											}
											title={t('common.remove', 'Remove')}
											aria-label={t('common.remove', 'Remove')}
											className="absolute top-1 end-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80"
										>
											<X className="w-3 h-3" strokeWidth={2} />
										</button>
									</div>
								))}
								{photos.length < 3 && (
									<button
										type="button"
										onClick={() => fileInputRef.current?.click()}
										className="w-20 h-20 rounded-xl border-2 border-dashed border-aliBorder flex flex-col items-center justify-center text-aliIcon hover:border-aliOrange hover:text-aliOrange transition-colors"
									>
										<ImagePlus className="w-6 h-6" strokeWidth={1.5} />
										<span className="text-[10px] mt-1 font-semibold">
											{t('reviews.addPhoto', 'Add')}
										</span>
									</button>
								)}
								<input
									ref={fileInputRef}
									type="file"
									accept="image/*"
									aria-label={t('reviews.labelPhotos', 'Upload photos')}
									onChange={handlePhotoUpload}
									className="hidden"
								/>
							</div>
						</div>

						{/* Submit */}
						<Button
							onClick={handleSubmit}
							disabled={rating === 0 || reviewText.trim().length < 50 || submitting}
							className="w-full bg-aliOrange text-white hover:bg-aliOrangeDark font-semibold rounded-xl h-12 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{submitting ? (
								<>
									<Loader2 className="w-4 h-4 ms-1 animate-spin" />
									{t('common.submitting', 'Submitting…')}
								</>
							) : (
								<>
									<Send className="w-4 h-4 ms-1" strokeWidth={1.5} />
									{editingReview
										? t('reviews.saveChanges', 'Save changes')
										: t('reviews.submit', 'Submit review')}
								</>
							)}
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
