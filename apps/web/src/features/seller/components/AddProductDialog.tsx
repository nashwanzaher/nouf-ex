/**
 * AddProductDialog — single-page, fast-entry product form.
 *
 * Designed for sellers with large catalogues (5,000+ products) who need
 * to add many items quickly. The form is a flat, scrollable page (no
 * multi-step wizard) so the merchant can type and tab through every
 * field without clicking "Next" between steps.
 *
 * Required fields (the only ones that block "Save & publish"):
 *   - product name (Arabic) *
 *   - category *
 *   - price *
 *   - at least one image *
 *
 * Everything else (English name, description, SKU, stock, variants,
 * shipping, etc.) is collapsed under "Show more options" and can be
 * filled in later via the product edit page.
 *
 * The category dropdown is populated from the live `/api/categories`
 * endpoint and shows the label in the merchant's current i18n
 * language (ar / en / zh) automatically.
 *
 * `keepOpen` mode lets the merchant save the current product and
 * immediately add another one without leaving the dialog — the
 * intended use-case for batch entry.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Upload, Check, ChevronDown } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useCategories } from '@/hooks/useApi';
import { createSellerProduct } from '@/lib/api';
import { cn } from '@/lib/utils';

interface AddProductDialogProps {
	open: boolean;
	onClose: () => void;
	onSaved?: (productId: number) => void;
}

interface FormState {
	// Required
	name_ar: string;
	category_id: string; // string while editing for the <select>, parsed on submit
	price: string;
	// Optional (in "Show more options")
	name_en: string;
	name_zh: string;
	description_ar: string;
	description_en: string;
	stock: string;
	sku: string;
}

const EMPTY_FORM: FormState = {
	name_ar: '',
	category_id: '',
	price: '',
	name_en: '',
	name_zh: '',
	description_ar: '',
	description_en: '',
	stock: '',
	sku: '',
};

export function AddProductDialog({ open, onClose, onSaved }: AddProductDialogProps) {
	const { t, i18n } = useTranslation();
	const { addToast } = useApp();
	const { data: categoriesData } = useCategories();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [form, setForm] = useState<FormState>(EMPTY_FORM);
	const [imageFile, setImageFile] = useState<File | null>(null);
	const [imagePreview, setImagePreview] = useState<string | null>(null);
	const [errors, setErrors] = useState<Partial<Record<keyof FormState | 'image', string>>>({});
	const [submitting, setSubmitting] = useState(false);
	const [showAdvanced, setShowAdvanced] = useState(false);
	const [keepOpen, setKeepOpen] = useState(false);

	// Reset form whenever the dialog opens.
	// We use the React-canonical "remount via key" pattern in the
	// parent component, so this AddProductDialog always mounts with
	// fresh state and no manual reset is needed here. If the parent
	// ever forgets to pass a key, we still want to reset on open.
	/* eslint-disable react-hooks/set-state-in-effect */
	useEffect(() => {
		if (open) {
			setForm(EMPTY_FORM);
			setImageFile(null);
			setImagePreview(null);
			setErrors({});
			setShowAdvanced(false);
		}
	}, [open]);
	/* eslint-enable react-hooks/set-state-in-effect */

	const categories = (categoriesData ?? []) as Array<{
		id: number;
		name_ar: string;
		name_en: string;
		name_zh: string;
		is_active: number;
	}>;

	// Pick the localized name based on the merchant's current language.
	const categoryName = (c: (typeof categories)[number]): string => {
		const lang = (i18n.language ?? 'en').slice(0, 2) as 'ar' | 'en' | 'zh';
		return c[`name_${lang}` as const] || c.name_en || c.name_ar;
	};

	const handleField =
		<K extends keyof FormState>(key: K) =>
		(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
			setForm((prev) => ({ ...prev, [key]: e.target.value }));
			setErrors((prev) => ({ ...prev, [key]: undefined }));
		};

	const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0] ?? null;
		setImageFile(file);
		setErrors((prev) => ({ ...prev, image: undefined }));
		if (file) {
			const reader = new FileReader();
			reader.onload = () => setImagePreview(reader.result as string);
			reader.readAsDataURL(file);
		} else {
			setImagePreview(null);
		}
	};

	const validate = (): boolean => {
		const errs: typeof errors = {};
		if (!form.name_ar.trim()) errs.name_ar = t('seller.fieldRequired', 'Required');
		if (!form.category_id) errs.category_id = t('seller.fieldRequired', 'Required');
		if (!form.price.trim() || Number(form.price) <= 0) {
			errs.price = t('seller.priceInvalid', 'Price must be greater than 0');
		}
		if (!imageFile) errs.image = t('seller.imageRequired', 'At least one image is required');
		setErrors(errs);
		return Object.keys(errs).length === 0;
	};

	const handleSubmit = async (saveAndClose: boolean) => {
		if (submitting) return;
		if (!validate()) {
			addToast({ type: 'error', message: t('seller.fixErrors', 'Please fix the highlighted fields') });
			return;
		}
		setSubmitting(true);
		try {
			const payload = {
				name_ar: form.name_ar.trim(),
				name_en: form.name_en.trim() || form.name_ar.trim(),
				name_zh: form.name_zh.trim() || form.name_ar.trim(),
				category_id: Number(form.category_id),
				price: Number(form.price),
				stock: form.stock.trim() ? Number(form.stock) : 0,
				description: form.description_en.trim() || form.description_ar.trim() || undefined,
				main_image: imagePreview ?? undefined,
			};
			const result = (await createSellerProduct(payload)) as { id: number } | undefined;
			addToast({ type: 'success', message: t('seller.productSaved', 'Product saved') });
			onSaved?.(result?.id ?? 0);

			if (saveAndClose || !keepOpen) {
				onClose();
			} else {
				// "Save & add another" — reset for the next entry
				setForm(EMPTY_FORM);
				setImageFile(null);
				setImagePreview(null);
				setErrors({});
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			addToast({ type: 'error', message: t('seller.saveFailed', 'Save failed') + ': ' + msg });
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<AnimatePresence>
			{open && (
				<>
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 bg-black/50 z-[200] backdrop-blur-sm"
						onClick={onClose}
					/>
					<motion.div
						initial={{ opacity: 0, scale: 0.97, y: 10 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.97, y: 10 }}
						transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
						className="fixed inset-3 md:inset-6 lg:inset-y-6 lg:left-1/2 lg:-translate-x-1/2 lg:max-w-2xl lg:w-full bg-white rounded-2xl z-[201] flex flex-col overflow-hidden"
					>
						{/* Header */}
						<div className="shrink-0 px-5 py-3 border-b border-[#F3EDE4] flex items-center justify-between">
							<div>
								<h2 className="text-base font-amiri font-bold text-[#1A1612]">
									{t('seller.addNewProduct', 'Add New Product')}
								</h2>
								<p className="text-[11px] text-[#6B6B6B] font-cairo">
									{t('seller.fastEntryHelp', 'Only the essentials — fill the rest later.')}
								</p>
							</div>
							<button
								type="button"
								onClick={onClose}
								title={t('common.close', 'Close')}
								aria-label={t('common.close', 'Close')}
								className="w-8 h-8 rounded-xl hover:bg-[#F8F8F8] flex items-center justify-center transition-colors"
							>
								<X className="w-4 h-4 text-[#6B6B6B]" strokeWidth={1.5} />
							</button>
						</div>

						{/* Body — single scrollable form */}
						<div className="flex-1 overflow-y-auto px-5 py-4">
							<form
								onSubmit={(e) => {
									e.preventDefault();
									void handleSubmit(true);
								}}
								className="space-y-4"
							>
								{/* Image uploader (required) */}
								<div>
									<label className="block text-xs font-cairo font-semibold text-[#111111] mb-1">
										{t('seller.productImage', 'Product image')} <span className="text-[#EF4444]">*</span>
									</label>
									<input
										ref={fileInputRef}
										type="file"
										accept="image/*"
										onChange={handleImageChange}
										className="hidden"
									/>
									<button
										type="button"
										onClick={() => fileInputRef.current?.click()}
										className={cn(
											'w-full border-2 border-dashed rounded-xl p-4 flex items-center gap-3 transition-colors text-start',
											errors.image
												? 'border-[#EF4444] bg-[rgba(239,68,68,0.04)]'
												: imagePreview
													? 'border-[#10B981] bg-[rgba(16,185,129,0.04)]'
													: 'border-[#D4A853] bg-[rgba(212,168,83,0.04)] hover:bg-[rgba(212,168,83,0.08)]',
										)}
									>
										{imagePreview ? (
											<img
												src={imagePreview}
												alt=""
												className="w-16 h-16 rounded-lg object-cover border border-[#F3EDE4]"
											/>
										) : (
											<div className="w-16 h-16 rounded-lg bg-white/60 flex items-center justify-center">
												<Upload className="w-5 h-5 text-[#D4A853]" strokeWidth={1.5} />
											</div>
										)}
										<div className="flex-1 min-w-0">
											<p className="text-xs font-cairo font-semibold text-[#111111] truncate">
												{imageFile
													? imageFile.name
													: t('seller.clickToUploadImage', 'Click to choose an image')}
											</p>
											<p className="text-[10px] text-[#6B6B6B] font-cairo mt-0.5">
												{imageFile
													? `${(imageFile.size / 1024).toFixed(0)} KB`
													: t('seller.imageHint', 'PNG, JPG, WEBP — up to 5MB')}
											</p>
										</div>
									</button>
									{errors.image && (
										<p className="text-[10px] text-[#EF4444] mt-1 font-cairo">{errors.image}</p>
									)}
								</div>

								{/* Name (AR) — required */}
								<div>
									<label
										htmlFor="prod-name-ar"
										className="block text-xs font-cairo font-semibold text-[#111111] mb-1"
									>
										{t('seller.productNameAr', 'Product name (Arabic)')}{' '}
										<span className="text-[#EF4444]">*</span>
									</label>
									<input
										id="prod-name-ar"
										type="text"
										value={form.name_ar}
										onChange={handleField('name_ar')}
										placeholder={t('seller.productNameArPlaceholder', 'مثال: عسل يمني أصلي 500 غرام')}
										dir="rtl"
										autoFocus
										className={cn(
											'w-full px-3 py-2.5 rounded-lg border outline-none text-sm font-cairo',
											errors.name_ar
												? 'border-[#EF4444]'
												: 'border-[#F3EDE4] focus:border-[#D4A853]',
										)}
									/>
									{errors.name_ar && (
										<p className="text-[10px] text-[#EF4444] mt-1 font-cairo">
											{errors.name_ar}
										</p>
									)}
								</div>

								{/* Category — required */}
								<div>
									<label
										htmlFor="prod-cat"
										className="block text-xs font-cairo font-semibold text-[#111111] mb-1"
									>
										{t('seller.categoryLabel', 'Category')}{' '}
										<span className="text-[#EF4444]">*</span>
									</label>
									<select
										id="prod-cat"
										value={form.category_id}
										onChange={handleField('category_id')}
										className={cn(
											'w-full px-3 py-2.5 rounded-lg border outline-none text-sm font-cairo bg-white',
											errors.category_id
												? 'border-[#EF4444]'
												: 'border-[#F3EDE4] focus:border-[#D4A853]',
										)}
									>
										<option value="">
											{t('seller.selectCategory', 'Select a category…')}
										</option>
										{categories
											.filter((c) => c.is_active)
											.map((c) => (
												<option key={c.id} value={String(c.id)}>
													{categoryName(c)}
												</option>
											))}
									</select>
									{errors.category_id && (
										<p className="text-[10px] text-[#EF4444] mt-1 font-cairo">
											{errors.category_id}
										</p>
									)}
								</div>

								{/* Price — required */}
								<div>
									<label
										htmlFor="prod-price"
										className="block text-xs font-cairo font-semibold text-[#111111] mb-1"
									>
										{t('seller.priceLabel', 'Price (YER)')}{' '}
										<span className="text-[#EF4444]">*</span>
									</label>
									<div className="relative">
										<input
											id="prod-price"
											type="number"
											min="0"
											step="0.01"
											value={form.price}
											onChange={handleField('price')}
											placeholder="4500"
											className={cn(
												'w-full pe-16 ps-3 py-2.5 rounded-lg border outline-none text-sm font-mono',
												errors.price
													? 'border-[#EF4444]'
													: 'border-[#F3EDE4] focus:border-[#D4A853]',
											)}
										/>
										<span className="absolute end-3 top-1/2 -translate-y-1/2 text-[10px] text-[#6B6B6B] font-cairo">
											ر.ي
										</span>
									</div>
									{errors.price && (
										<p className="text-[10px] text-[#EF4444] mt-1 font-cairo">{errors.price}</p>
									)}
								</div>

								{/* Advanced toggle */}
								<button
									type="button"
									onClick={() => setShowAdvanced((s) => !s)}
									className="flex items-center gap-1.5 text-xs font-cairo font-semibold text-[#D4A853] hover:text-[#c49a48] transition-colors"
								>
									<ChevronDown
										className={cn(
											'w-3.5 h-3.5 transition-transform',
											showAdvanced && 'rotate-180',
										)}
										strokeWidth={2}
									/>
									{t('seller.showMoreOptions', 'Show more options')}
									<span className="text-[10px] text-[#AAAAAA] font-cairo font-normal">
										{t('seller.optionalFields', '(optional)')}
									</span>
								</button>

								{showAdvanced && (
									<div className="space-y-3 ps-4 border-s-2 border-[#F3EDE4]">
										{/* Name (EN) */}
										<div>
											<label
												htmlFor="prod-name-en"
												className="block text-[11px] font-cairo font-semibold text-[#6B6B6B] mb-1"
											>
												{t('seller.productNameEn', 'Product name (English)')}
											</label>
											<input
												id="prod-name-en"
												type="text"
												value={form.name_en}
												onChange={handleField('name_en')}
												placeholder={t(
													'seller.productNameEnPlaceholder',
													'e.g. Original Yemeni Sidr Honey 500g',
												)}
												dir="ltr"
												className="w-full px-3 py-2 rounded-lg border border-[#F3EDE4] focus:border-[#D4A853] outline-none text-sm font-cairo"
											/>
										</div>

										{/* Description (AR + EN) */}
										<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
											<div>
												<label
													htmlFor="prod-desc-ar"
													className="block text-[11px] font-cairo font-semibold text-[#6B6B6B] mb-1"
												>
													{t('seller.descriptionAr', 'Description (AR)')}
												</label>
												<textarea
													id="prod-desc-ar"
													rows={3}
													value={form.description_ar}
													onChange={handleField('description_ar')}
													dir="rtl"
													className="w-full px-3 py-2 rounded-lg border border-[#F3EDE4] focus:border-[#D4A853] outline-none text-xs font-cairo resize-none"
												/>
											</div>
											<div>
												<label
													htmlFor="prod-desc-en"
													className="block text-[11px] font-cairo font-semibold text-[#6B6B6B] mb-1"
												>
													{t('seller.descriptionEn', 'Description (EN)')}
												</label>
												<textarea
													id="prod-desc-en"
													rows={3}
													value={form.description_en}
													onChange={handleField('description_en')}
													dir="ltr"
													className="w-full px-3 py-2 rounded-lg border border-[#F3EDE4] focus:border-[#D4A853] outline-none text-xs font-cairo resize-none"
												/>
											</div>
										</div>

										{/* Stock + SKU */}
										<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
											<div>
												<label
													htmlFor="prod-stock"
													className="block text-[11px] font-cairo font-semibold text-[#6B6B6B] mb-1"
												>
													{t('seller.stockLabel', 'Stock')}
												</label>
												<input
													id="prod-stock"
													type="number"
													min="0"
													step="1"
													value={form.stock}
													onChange={handleField('stock')}
													placeholder="0"
													className="w-full px-3 py-2 rounded-lg border border-[#F3EDE4] focus:border-[#D4A853] outline-none text-sm font-mono"
												/>
											</div>
											<div>
												<label
													htmlFor="prod-sku"
													className="block text-[11px] font-cairo font-semibold text-[#6B6B6B] mb-1"
												>
													SKU
												</label>
												<input
													id="prod-sku"
													type="text"
													value={form.sku}
													onChange={handleField('sku')}
													placeholder={t('seller.skuAutoPlaceholder', 'Auto-generated if empty')}
													dir="ltr"
													className="w-full px-3 py-2 rounded-lg border border-[#F3EDE4] focus:border-[#D4A853] outline-none text-sm font-mono"
												/>
											</div>
										</div>
									</div>
								)}
							</form>
						</div>

						{/* Footer */}
						<div className="shrink-0 px-5 py-3 border-t border-[#F3EDE4] flex items-center justify-between gap-2 flex-wrap">
							<label className="flex items-center gap-1.5 text-[11px] text-[#6B6B6B] font-cairo cursor-pointer">
								<input
									type="checkbox"
									checked={keepOpen}
									onChange={(e) => setKeepOpen(e.target.checked)}
									className="w-3.5 h-3.5 accent-[#D4A853]"
								/>
								{t('seller.saveAndAddAnother', 'Save & add another')}
							</label>
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={onClose}
									disabled={submitting}
									className="px-3 py-2 rounded-lg border border-[#F3EDE4] text-xs font-cairo font-semibold text-[#6B6B6B] hover:bg-[#F8F8F8] transition-colors disabled:opacity-50"
								>
									{t('common.cancel', 'Cancel')}
								</button>
								<button
									type="button"
									onClick={() => void handleSubmit(keepOpen ? false : true)}
									disabled={submitting}
									className="px-4 py-2 rounded-lg bg-[#D4A853] hover:bg-[#c49a48] text-[#1A1612] text-xs font-cairo font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
								>
									{submitting ? (
										<span className="w-3.5 h-3.5 border-2 border-[#1A1612] border-t-transparent rounded-full animate-spin" />
									) : (
										<Check className="w-3.5 h-3.5" strokeWidth={2} />
									)}
									{keepOpen
										? t('seller.saveAndNext', 'Save & next')
										: t('seller.save', 'Save')}
								</button>
							</div>
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}

export default AddProductDialog;
