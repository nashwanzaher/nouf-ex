import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Star, Package, Send, Trash2, Edit3, X, CheckCircle, Clock, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import CustomerSidebar from './CustomerSidebar';

interface PendingReview {
	id: number;
	productName: string;
	purchaseDate: string;
	merchant: string;
}

interface SubmittedReview {
	id: number;
	productName: string;
	rating: number;
	text: string;
	date: string;
	photos: string[];
	merchantReply?: string;
	canEdit: boolean;
}

const pendingReviews: PendingReview[] = [
	{
		id: 1,
		productName: 'سماعات لاسلكية فاخرة مع إلغاء الضوضاء',
		purchaseDate: '١٥ يونيو ٢٠٢٥',
		merchant: 'إلكترونيات اليمن',
	},
	{
		id: 2,
		productName: 'ساعة ذكية رياضية مقاومة للماء',
		purchaseDate: '١٠ يونيو ٢٠٢٥',
		merchant: 'تك ستور',
	},
	{
		id: 3,
		productName: 'عسل يمني كريمي درجة أولى',
		purchaseDate: '٥ يونيو ٢٠٢٥',
		merchant: 'منتجات يمنية',
	},
];

const initialSubmitted: SubmittedReview[] = [
	{
		id: 101,
		productName: 'حقيبة جلدية يدوية أصلية',
		rating: 5,
		text: 'منتج رائع وجودة عالية جداً! الخامة ممتازة والتفاصيل دقيقة. التوصيل كان سريع والتغليف ممتاز. أنصح به بشدة.',
		date: '٢٠ مايو ٢٠٢٥',
		photos: [],
		merchantReply: 'شكراً لثقتك! نسعد دائماً بخدمتك.',
		canEdit: false,
	},
	{
		id: 102,
		productName: 'بن يمني محمص فاخر',
		rating: 4,
		text: 'طعم ممتاز ورائحة خيالية. سأطلبه مرة أخرى بالتأكيد.',
		date: '١٨ مايو ٢٠٢٥',
		photos: [],
		canEdit: true,
	},
];

function StarRatingInput({
	rating,
	onRate,
	ratingTexts,
}: {
	rating: number;
	onRate: (r: number) => void;
	ratingTexts: Record<number, string>;
}) {
	const [hover, setHover] = useState(0);
	return (
		<div className="flex items-center gap-1">
			{[1, 2, 3, 4, 5].map((s) => (
				<button
					key={s}
					type="button"
					onMouseEnter={() => setHover(s)}
					onMouseLeave={() => setHover(0)}
					onClick={() => onRate(s)}
					title={`${s} star${s > 1 ? 's' : ''}`}
					aria-label={`${s} star${s > 1 ? 's' : ''}`}
					className="transition-transform hover:scale-110 focus:outline-none"
				>
					<Star
						className={`w-8 h-8 transition-colors ${
							s <= (hover || rating)
								? 'text-[#D4A853] fill-[#D4A853]'
								: 'text-[#AAAAAA]'
						}`}
						strokeWidth={1.5}
					/>
				</button>
			))}
			<span className="text-sm text-[#6B6B6B] font-cairo mr-2">
				{rating > 0 ? (ratingTexts[rating] ?? '') : ''}
			</span>
		</div>
	);
}

export default function Reviews() {
	const { t } = useTranslation();
	const ratingTexts: Record<number, string> = {
		1: t('reviews.ratingText1', 'Poor'),
		2: t('reviews.ratingText2', 'Fair'),
		3: t('reviews.ratingText3', 'Good'),
		4: t('reviews.ratingText4', 'Very good'),
		5: t('reviews.ratingText5', 'Excellent'),
	};
	const [activeTab, setActiveTab] = useState<'pending' | 'submitted'>('pending');
	const [reviewTab, setReviewTab] = useState('all');
	const [dialogOpen, setDialogOpen] = useState(false);
	const [selectedPending, setSelectedPending] = useState<PendingReview | null>(null);
	const [rating, setRating] = useState(0);
	const [reviewText, setReviewText] = useState('');
	const [photos, setPhotos] = useState<string[]>([]);
	const [submitted, setSubmitted] = useState<SubmittedReview[]>(initialSubmitted);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const openReviewDialog = (item: PendingReview) => {
		setSelectedPending(item);
		setRating(0);
		setReviewText('');
		setPhotos([]);
		setDialogOpen(true);
	};

	const handleSubmitReview = () => {
		if (!selectedPending || rating === 0) return;
		const newReview: SubmittedReview = {
			id: Date.now(),
			productName: selectedPending.productName,
			rating,
			text: reviewText,
			date: 'اليوم',
			photos: [...photos],
			canEdit: true,
		};
		setSubmitted((prev) => [newReview, ...prev]);
		setDialogOpen(false);
		setActiveTab('submitted');
	};

	const handleDeleteReview = (id: number) => {
		setSubmitted((prev) => prev.filter((r) => r.id !== id));
	};

	const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file && photos.length < 3) {
			const reader = new FileReader();
			reader.onload = () => {
				setPhotos((prev) => [...prev, reader.result as string]);
			};
			reader.readAsDataURL(file);
		}
	};

	const filteredSubmitted =
		reviewTab === 'all'
			? submitted
			: reviewTab === 'positive'
				? submitted.filter((r) => r.rating >= 4)
				: submitted.filter((r) => r.rating <= 2);

	return (
		<div className="min-h-[100dvh] bg-[#F8F8F8]" dir="rtl">
			<CustomerSidebar />

			<div className="md:mr-60 min-h-[100dvh]">
				<div className="bg-white border-b border-[#F3EDE4] px-6 py-4 sticky top-0 z-30">
					<h1 className="text-2xl font-amiri font-bold text-[#1A1612]">
						{t('reviews.title', 'My Reviews')}
					</h1>
					<p className="text-sm text-[#6B6B6B] font-cairo mt-1">
						{t('reviews.subtitle', 'Manage your reviews')}
					</p>
				</div>

				<div className="p-6 max-w-4xl mx-auto space-y-6">
					{/* Tabs */}
					<div className="flex gap-2">
						<button
							onClick={() => setActiveTab('pending')}
							className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-cairo font-medium transition-colors ${
								activeTab === 'pending'
									? 'bg-[#D4A853] text-[#1A1612]'
									: 'bg-white text-[#6B6B6B] hover:bg-[#F3EDE4]'
							}`}
						>
							<Clock className="w-4 h-4" strokeWidth={1.5} />
							{t('reviews.tabPending', 'Pending')}
							<span className="bg-[#1A1612]/10 text-[#1A1612] text-[10px] font-bold px-1.5 py-0.5 rounded-full">
								{pendingReviews.length}
							</span>
						</button>
						<button
							onClick={() => setActiveTab('submitted')}
							className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-cairo font-medium transition-colors ${
								activeTab === 'submitted'
									? 'bg-[#D4A853] text-[#1A1612]'
									: 'bg-white text-[#6B6B6B] hover:bg-[#F3EDE4]'
							}`}
						>
							<CheckCircle className="w-4 h-4" strokeWidth={1.5} />
							{t('reviews.tabSubmitted', 'Submitted')}
							<span className="bg-[#1A1612]/10 text-[#1A1612] text-[10px] font-bold px-1.5 py-0.5 rounded-full">
								{submitted.length}
							</span>
						</button>
					</div>

					{activeTab === 'pending' && (
						<div className="space-y-3">
							{pendingReviews.length === 0 ? (
								<div className="bg-white rounded-2xl p-12 text-center shadow-sm">
									<CheckCircle
										className="w-16 h-16 text-[#10B981] mx-auto mb-4"
										strokeWidth={1.5}
									/>
									<h3 className="text-xl font-amiri font-bold text-[#1A1612] mb-2">
										{t('reviews.emptyPendingTitle', 'No products to review')}
									</h3>
									<p className="text-[#6B6B6B] font-cairo text-sm">
										{t(
											'reviews.emptyPendingSubtitle',
											"You've reviewed all your products",
										)}
									</p>
								</div>
							) : (
								pendingReviews.map((item) => (
									<div
										key={item.id}
										className="bg-white rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4"
									>
										<div className="w-16 h-16 rounded-xl bg-[#F8F8F8] flex items-center justify-center shrink-0">
											<Package
												className="w-8 h-8 text-[#AAAAAA]"
												strokeWidth={1}
											/>
										</div>
										<div className="flex-1">
											<h3 className="font-cairo font-semibold text-sm text-[#111111]">
												{item.productName}
											</h3>
											<div className="flex items-center gap-2 mt-1 text-xs text-[#6B6B6B] font-cairo">
												<span>{item.merchant}</span>
												<span>·</span>
												<Clock className="w-3 h-3" strokeWidth={1.5} />
												<span>
													{t('reviews.purchaseDate', 'Purchase date')}:{' '}
													{item.purchaseDate}
												</span>
											</div>
										</div>
										<Button
											onClick={() => openReviewDialog(item)}
											className="bg-[#D4A853] text-[#1A1612] hover:bg-[#c49a48] font-cairo font-semibold rounded-xl shrink-0"
										>
											<Star className="w-4 h-4 ml-1" strokeWidth={1.5} />
											{t('reviews.writeButton', 'Write a review')}
										</Button>
									</div>
								))
							)}
						</div>
					)}

					{activeTab === 'submitted' && (
						<div className="space-y-4">
							{/* Sub-tabs */}
							<div className="flex gap-2 overflow-x-auto">
								{[
									{ key: 'all', label: t('reviews.subTabAll', 'All') },
									{
										key: 'positive',
										label: t('reviews.subTabPositive', 'Positive'),
									},
									{
										key: 'negative',
										label: t('reviews.subTabNegative', 'Negative'),
									},
								].map((tab) => (
									<button
										key={tab.key}
										onClick={() => setReviewTab(tab.key)}
										className={`px-4 py-2 rounded-full text-sm font-cairo font-medium whitespace-nowrap transition-colors ${
											reviewTab === tab.key
												? 'bg-[#D4A853] text-[#1A1612]'
												: 'bg-white text-[#6B6B6B] hover:bg-[#F3EDE4]'
										}`}
									>
										{tab.label}
									</button>
								))}
							</div>

							{filteredSubmitted.length === 0 ? (
								<div className="bg-white rounded-2xl p-12 text-center shadow-sm">
									<Star
										className="w-16 h-16 text-[#AAAAAA] mx-auto mb-4"
										strokeWidth={1}
									/>
									<h3 className="text-xl font-amiri font-bold text-[#1A1612] mb-2">
										{t('reviews.empty', 'No reviews')}
									</h3>
								</div>
							) : (
								filteredSubmitted.map((review) => (
									<div
										key={review.id}
										className="bg-white rounded-2xl shadow-sm overflow-hidden"
									>
										<div className="p-5">
											<div className="flex items-start justify-between gap-4">
												<div className="flex items-start gap-3">
													<div className="w-12 h-12 rounded-xl bg-[#F8F8F8] flex items-center justify-center shrink-0">
														<Package
															className="w-6 h-6 text-[#AAAAAA]"
															strokeWidth={1}
														/>
													</div>
													<div>
														<h3 className="font-cairo font-semibold text-sm text-[#111111]">
															{review.productName}
														</h3>
														<div className="flex items-center gap-1 mt-1">
															{[1, 2, 3, 4, 5].map((s) => (
																<Star
																	key={s}
																	className={`w-4 h-4 ${s <= review.rating ? 'text-[#D4A853] fill-[#D4A853]' : 'text-[#AAAAAA]'}`}
																	strokeWidth={1.5}
																/>
															))}
															<span className="text-xs text-[#6B6B6B] font-cairo mr-2">
																{review.date}
															</span>
														</div>
													</div>
												</div>
												<div className="flex items-center gap-1 shrink-0">
													{review.canEdit && (
														<button
															title={t('common.edit', 'Edit')}
															aria-label={t('common.edit', 'Edit')}
															className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F8F8F8] text-[#6B6B6B]"
														>
															<Edit3
																className="w-4 h-4"
																strokeWidth={1.5}
															/>
														</button>
													)}
													<button
														onClick={() =>
															handleDeleteReview(review.id)
														}
														title={t('common.delete', 'Delete')}
														aria-label={t('common.delete', 'Delete')}
														className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#EF4444]/10 text-[#6B6B6B] hover:text-[#EF4444]"
													>
														<Trash2
															className="w-4 h-4"
															strokeWidth={1.5}
														/>
													</button>
												</div>
											</div>

											<p className="text-sm text-[#111111] font-cairo mt-3 leading-relaxed">
												{review.text}
											</p>

											{review.photos.length > 0 && (
												<div className="flex gap-2 mt-3">
													{review.photos.map((photo, idx) => (
														<div
															key={idx}
															className="w-20 h-20 rounded-lg overflow-hidden bg-[#F8F8F8]"
														>
															<img
																src={photo}
																alt=""
																className="w-full h-full object-cover"
															/>
														</div>
													))}
												</div>
											)}

											{review.merchantReply && (
												<div className="mt-4 bg-[#F3EDE4] rounded-xl p-4 border-r-3 border-r-[#D4A853]">
													<div className="flex items-center gap-2 mb-2">
														<Package
															className="w-4 h-4 text-[#D4A853]"
															strokeWidth={1.5}
														/>
														<span className="text-xs font-cairo font-semibold text-[#D4A853]">
															{t(
																'reviews.merchantReply',
																'Merchant reply',
															)}
														</span>
													</div>
													<p className="text-sm text-[#6B6B6B] font-cairo">
														{review.merchantReply}
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

			{/* Review Dialog */}
			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent className="sm:max-w-lg rounded-2xl" dir="rtl">
					<DialogHeader>
						<DialogTitle className="font-amiri text-xl text-[#1A1612]">
							{t('reviews.dialogTitle', 'Write a review')}
						</DialogTitle>
					</DialogHeader>
					{selectedPending && (
						<div className="space-y-5 pt-2">
							<div className="flex items-center gap-3 bg-[#F8F8F8] rounded-xl p-3">
								<div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center">
									<Package className="w-6 h-6 text-[#AAAAAA]" strokeWidth={1} />
								</div>
								<div>
									<p className="font-cairo font-semibold text-sm text-[#111111]">
										{selectedPending.productName}
									</p>
									<p className="text-xs text-[#6B6B6B] font-cairo">
										{selectedPending.merchant}
									</p>
								</div>
							</div>

							<div>
								<label className="block text-sm font-cairo font-semibold text-[#111111] mb-2">
									{t('reviews.labelRating', 'Rating')}
								</label>
								<StarRatingInput
									rating={rating}
									onRate={setRating}
									ratingTexts={ratingTexts}
								/>
							</div>

							<div>
								<label className="block text-sm font-cairo font-semibold text-[#111111] mb-2">
									{t('reviews.labelComment', 'Your comment')}
								</label>
								<Textarea
									value={reviewText}
									onChange={(e) => setReviewText(e.target.value)}
									placeholder={t(
										'reviews.commentPlaceholder',
										'Share your experience with this product... (50 chars min)',
									)}
									className="min-h-[120px] rounded-xl font-cairo text-sm resize-none"
								/>
								<p className="text-[10px] text-[#AAAAAA] font-cairo mt-1">
									{t('reviews.charCount', `${reviewText.length} chars`)}
								</p>
							</div>

							<div>
								<label className="block text-sm font-cairo font-semibold text-[#111111] mb-2">
									{t('reviews.labelPhotos', 'Photos (optional)')}
								</label>
								<div className="flex gap-2 flex-wrap">
									{photos.map((photo, idx) => (
										<div
											key={idx}
											className="relative w-20 h-20 rounded-xl overflow-hidden"
										>
											<img
												src={photo}
												alt=""
												className="w-full h-full object-cover"
											/>
											<button
												onClick={() =>
													setPhotos((prev) =>
														prev.filter((_, i) => i !== idx),
													)
												}
												title={t('common.remove', 'Remove')}
												aria-label={t('common.remove', 'Remove')}
												className="absolute top-1 left-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center text-white"
											>
												<X className="w-3 h-3" strokeWidth={2} />
											</button>
										</div>
									))}
									{photos.length < 3 && (
										<button
											onClick={() => fileInputRef.current?.click()}
											className="w-20 h-20 rounded-xl border-2 border-dashed border-[#AAAAAA] flex flex-col items-center justify-center text-[#AAAAAA] hover:border-[#D4A853] hover:text-[#D4A853] transition-colors"
										>
											<ImagePlus className="w-6 h-6" strokeWidth={1.5} />
											<span className="text-[10px] font-cairo mt-1">
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

							<Button
								onClick={handleSubmitReview}
								disabled={rating === 0 || reviewText.length < 10}
								className="w-full bg-[#D4A853] text-[#1A1612] hover:bg-[#c49a48] font-cairo font-semibold rounded-xl h-12"
							>
								<Send className="w-4 h-4 ml-1" strokeWidth={1.5} />
								{t('reviews.submit', 'Submit review')}
							</Button>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}
