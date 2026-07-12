import { useState, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { useSellerProducts } from '@/hooks/useApi';
import { deleteSellerProduct } from '@/lib/api';
import { cn } from '@/lib/utils';
import DashboardShell from './DashboardShell';
import {
	Search,
	Grid3X3,
	List,
	Plus,
	Download,
	Upload,
	Edit3,
	Trash2,
	Eye,
	ChevronRight,
	ChevronLeft,
	X,
	Camera,
	Package,
	ShoppingBag,
	Tag,
	Box,
	Truck,
	FileText,
	Check,
	ImageIcon,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Product {
	id: number;
	name: string;
	price: string;
	stock: number;
	status: 'active' | 'low' | 'out' | 'disabled';
	views: number;
	orders: number;
	image: string;
	category: string;
}

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

/* ------------------------------------------------------------------ */
/*  Constants                                                            */
/* ------------------------------------------------------------------ */

const CATEGORY_KEYS = [
	{ key: 'all', labelKey: 'seller.allCategories' },
	{ key: 'electronics', labelKey: 'seller.catElectronics' },
	{ key: 'fashion', labelKey: 'seller.catFashion' },
	{ key: 'food', labelKey: 'seller.catFood' },
	{ key: 'jewelry', labelKey: 'seller.catJewelry' },
	{ key: 'home', labelKey: 'seller.catHome' },
];

const STATUS_FILTER_KEYS = [
	{ key: 'all', labelKey: 'common.all' },
	{ key: 'active', labelKey: 'seller.statusActive' },
	{ key: 'low', labelKey: 'seller.statusLow' },
	{ key: 'out', labelKey: 'seller.statusOut' },
	{ key: 'disabled', labelKey: 'seller.statusDisabled' },
];

/* ------------------------------------------------------------------ */
/*  StatusBadge component                                              */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: Product['status'] }) {
	const { t } = useTranslation();
	const config = {
		active: {
			label: t('seller.statusActive', 'Active'),
			className: 'bg-[rgba(16,185,129,0.12)] text-[#10B981]',
		},
		low: {
			label: t('seller.statusLow', 'Low Stock'),
			className: 'bg-[rgba(245,158,11,0.12)] text-[#F59E0B]',
		},
		out: {
			label: t('seller.statusOut', 'Out of Stock'),
			className: 'bg-[rgba(239,68,68,0.12)] text-[#EF4444]',
		},
		disabled: {
			label: t('seller.statusDisabled', 'Disabled'),
			className: 'bg-[rgba(107,107,107,0.12)] text-[#6B6B6B]',
		},
	};
	const c = config[status];
	return <span className={`px-2 py-0.5 rounded text-xs font-cairo font-medium ${c.className}`}>{c.label}</span>;
}

/* ------------------------------------------------------------------ */
/*  Add Product Wizard                                                 */
/* ------------------------------------------------------------------ */

function AddProductWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
	const { t } = useTranslation();
	const [step, setStep] = useState<WizardStep>(1);
	const [images, setImages] = useState<string[]>([]);
	const [_errors, setErrors] = useState<Record<string, string>>({});
	const fileInputRef = useRef<HTMLInputElement>(null);
	const formRef = useRef<HTMLFormElement>(null);

	const steps = [
		{ num: 1, label: t('seller.stepBasics', 'Basic Info'), icon: FileText },
		{ num: 2, label: t('seller.stepImages', 'Images'), icon: Camera },
		{ num: 3, label: t('seller.stepPricing', 'Pricing & Stock'), icon: Tag },
		{ num: 4, label: t('seller.stepVariants', 'Variants'), icon: Box },
		{ num: 5, label: t('seller.stepShipping', 'Shipping'), icon: Truck },
		{ num: 6, label: t('seller.stepReview', 'Review'), icon: Check },
	];

	const handleImageUpload = () => {
		if (images.length >= 8) return;
		const newImages = [...images];
		for (let i = images.length; i < Math.min(images.length + 3, 8); i++) {
			newImages.push(`Product ${i + 1}`);
		}
		setImages(newImages);
	};

	const removeImage = (idx: number) => {
		setImages((prev) => prev.filter((_, i) => i !== idx));
	};

	const handleNext = () => {
		// Validate current step before advancing
		const stepErrors = validateStep(step);
		if (Object.keys(stepErrors).length > 0) {
			setErrors(stepErrors);
			return;
		}
		setErrors({});
		if (step < 6) setStep((s) => (s + 1) as WizardStep);
	};

	/** Validate fields for the current wizard step.
	 *  Returns a map of field key → error message. Empty map = valid. */
	const validateStep = (s: WizardStep): Record<string, string> => {
		const errs: Record<string, string> = {};
		if (s === 1) {
			// Step 1 — Basic Info (name + description are required)
			const name = (formRef.current?.name ?? '').toString().trim();
			const desc = (formRef.current?.description ?? '').toString().trim();
			if (!name) errs.name = t('seller.fieldRequired', 'This field is required');
			if (!desc) errs.description = t('seller.fieldRequired', 'This field is required');
		} else if (s === 3) {
			// Step 3 — Pricing & Stock
			const price = Number(formRef.current?.price ?? 0);
			const stock = Number(formRef.current?.stock ?? 0);
			if (!price || price <= 0) errs.price = t('seller.priceInvalid', 'Price must be greater than 0');
			if (!Number.isInteger(stock) || stock < 0) errs.stock = t('seller.stockInvalid', 'Stock must be a non-negative integer');
		}
		return errs;
	};

	const handlePrev = () => {
		if (step > 1) setStep((s) => (s - 1) as WizardStep);
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
						initial={{ opacity: 0, scale: 0.95, y: 20 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.95, y: 20 }}
						transition={{
							duration: 0.2,
							ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
						}}
						className="fixed inset-4 md:inset-8 lg:inset-16 bg-white rounded-3xl z-[201] flex flex-col overflow-hidden"
					>
						{/* Wizard Header */}
						<div className="shrink-0 px-6 py-4 border-b border-[#F3EDE4] flex items-center justify-between">
							<h2 className="text-lg font-amiri font-bold text-[#1A1612]">
								{t('seller.addNewProduct', 'Add New Product')}
							</h2>
							<button
								onClick={onClose}
								title={t('common.close', 'Close')}
								aria-label={t('common.close', 'Close')}
								className="w-8 h-8 rounded-xl hover:bg-[#F8F8F8] flex items-center justify-center transition-colors"
							>
								<X className="w-5 h-5 text-[#6B6B6B]" strokeWidth={1.5} />
							</button>
						</div>

						{/* Step Indicator */}
						<div className="shrink-0 px-6 py-4 overflow-x-auto">
							<div className="flex items-center gap-2 min-w-max">
								{steps.map((s, i) => (
									<div key={s.num} className="flex items-center gap-2">
										<div
											className={cn(
												'flex items-center gap-2 px-3 py-2 rounded-xl transition-all',
												step === s.num
													? 'bg-[rgba(212,168,83,0.15)]'
													: step > s.num
														? 'bg-[rgba(16,185,129,0.1)]'
														: 'bg-[#F8F8F8]',
											)}
										>
											<div
												className={cn(
													'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
													step === s.num
														? 'bg-[#D4A853] text-[#1A1612]'
														: step > s.num
															? 'bg-[#10B981] text-white'
															: 'bg-[#AAAAAA] text-white',
												)}
											>
												{step > s.num ? (
													<Check className="w-3 h-3" strokeWidth={2} />
												) : (
													s.num
												)}
											</div>
											<span
												className={cn(
													'text-xs font-cairo font-semibold hidden sm:inline',
													step === s.num
														? 'text-[#D4A853]'
														: step > s.num
															? 'text-[#10B981]'
															: 'text-[#6B6B6B]',
												)}
											>
												{s.label}
											</span>
										</div>
										{i < steps.length - 1 && (
											<div
												className={cn(
													'w-4 h-0.5 rounded-full',
													step > s.num ? 'bg-[#10B981]' : 'bg-[#F3EDE4]',
												)}
											/>
										)}
									</div>
								))}
							</div>
						</div>

						{/* Wizard Content */}
						<div className="flex-1 overflow-y-auto px-6 py-4">
							<AnimatePresence mode="wait">
								<motion.div
									key={step}
									initial={{ opacity: 0, x: 20 }}
									animate={{ opacity: 1, x: 0 }}
									exit={{ opacity: 0, x: -20 }}
									transition={{ duration: 0.2 }}
								>
									{step === 1 && (
										<div className="space-y-4 max-w-2xl">
											<div>
												<label className="block text-sm font-cairo font-semibold text-[#111111] mb-1.5">
													{t('seller.productNameLabel', 'Product name')} *
												</label>
												<input
													type="text"
													placeholder={t(
														'seller.productNamePlaceholder',
														'Enter product name',
													)}
													className="w-full px-4 py-3 rounded-xl border border-[#AAAAAA] focus:border-[#D4A853] focus:ring-2 focus:ring-[rgba(212,168,83,0.2)] outline-none transition-all text-sm font-cairo"
												/>
											</div>
											<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
												<div>
													<label className="block text-sm font-cairo font-semibold text-[#111111] mb-1.5">
														الفئة *
													</label>
													<select
														aria-label={t(
															'seller.categoryLabel',
															'Category',
														)}
														className="w-full px-4 py-3 rounded-xl border border-[#AAAAAA] focus:border-[#D4A853] focus:ring-2 focus:ring-[rgba(212,168,83,0.2)] outline-none transition-all text-sm font-cairo bg-white"
													>
														<option>
															{t(
																'seller.selectCategory',
																'Select category',
															)}
														</option>
														{CATEGORY_KEYS.slice(1).map((c) => (
															<option key={c.key} value={c.key}>
																{t(c.labelKey)}
															</option>
														))}
													</select>
												</div>
												<div>
													<label className="block text-sm font-cairo font-semibold text-[#111111] mb-1.5">
														العلامة التجارية
													</label>
													<input
														type="text"
														placeholder={t(
															'seller.brandPlaceholder',
															'Brand',
														)}
														className="w-full px-4 py-3 rounded-xl border border-[#AAAAAA] focus:border-[#D4A853] focus:ring-2 focus:ring-[rgba(212,168,83,0.2)] outline-none transition-all text-sm font-cairo"
													/>
												</div>
											</div>
											<div>
												<label className="block text-sm font-cairo font-semibold text-[#111111] mb-1.5">
													{t(
														'seller.descriptionLabel',
														'Product description',
													)}
												</label>
												<textarea
													rows={4}
													placeholder={t(
														'seller.descriptionPlaceholder',
														'Write detailed product description...',
													)}
													className="w-full px-4 py-3 rounded-xl border border-[#AAAAAA] focus:border-[#D4A853] focus:ring-2 focus:ring-[rgba(212,168,83,0.2)] outline-none transition-all text-sm font-cairo resize-none"
												/>
											</div>
										</div>
									)}

									{step === 2 && (
										<div className="max-w-2xl">
											<input
												ref={fileInputRef}
												type="file"
												multiple
												accept="image/*"
												aria-label={t(
													'seller.uploadImages',
													'Upload product images',
												)}
												className="hidden"
											/>
											<div
												onClick={handleImageUpload}
												className="border-2 border-dashed border-[#D4A853] rounded-2xl p-8 text-center cursor-pointer hover:bg-[rgba(212,168,83,0.05)] transition-colors"
											>
												<Camera
													className="w-10 h-10 text-[#D4A853] mx-auto mb-3"
													strokeWidth={1.5}
												/>
												<p className="text-sm font-cairo font-semibold text-[#111111]">
													{t(
														'seller.dragImagesHere',
														'Drag images here or click to select',
													)}
												</p>
												<p className="text-xs text-[#6B6B6B] font-cairo mt-1">
													{t(
														'seller.imageLimits',
														'PNG, JPG up to 5MB — max 8 images',
													)}
												</p>
											</div>
											{images.length > 0 && (
												<div className="grid grid-cols-4 gap-3 mt-4">
													{images.map((_, i) => (
														<div
															key={i}
															className="relative aspect-square rounded-xl bg-[#F3EDE4] flex items-center justify-center overflow-hidden group"
														>
															<ImageIcon
																className="w-6 h-6 text-[#AAAAAA]"
																strokeWidth={1.5}
															/>
															<button
																onClick={(e) => {
																	e.stopPropagation();
																	removeImage(i);
																}}
																title={t('common.remove', 'Remove')}
																aria-label={t(
																	'common.remove',
																	'Remove',
																)}
																className="absolute top-1 left-1 w-6 h-6 rounded-full bg-[#EF4444] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
															>
																<X
																	className="w-3 h-3"
																	strokeWidth={2}
																/>
															</button>
															<span className="absolute bottom-1 right-1 text-[10px] font-mono text-[#6B6B6B]">
																{i + 1}
															</span>
														</div>
													))}
												</div>
											)}
										</div>
									)}

									{step === 3 && (
										<div className="space-y-4 max-w-2xl">
											<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
												<div>
													<label className="block text-sm font-cairo font-semibold text-[#111111] mb-1.5">
														{t('seller.priceLabel', 'Price')} *
													</label>
													<input
														type="text"
														placeholder="٠"
														className="w-full px-4 py-3 rounded-xl border border-[#AAAAAA] focus:border-[#D4A853] focus:ring-2 focus:ring-[rgba(212,168,83,0.2)] outline-none transition-all text-sm font-cairo"
													/>
												</div>
												<div>
													<label className="block text-sm font-cairo font-semibold text-[#111111] mb-1.5">
														{t('seller.comparePriceLabel', 'Compare-at price')}
													</label>
													<input
														type="text"
														placeholder="٠"
														className="w-full px-4 py-3 rounded-xl border border-[#AAAAAA] focus:border-[#D4A853] focus:ring-2 focus:ring-[rgba(212,168,83,0.2)] outline-none transition-all text-sm font-cairo"
													/>
												</div>
												<div>
													<label className="block text-sm font-cairo font-semibold text-[#111111] mb-1.5">
														التكلفة
													</label>
													<input
														type="text"
														placeholder="٠"
														className="w-full px-4 py-3 rounded-xl border border-[#AAAAAA] focus:border-[#D4A853] focus:ring-2 focus:ring-[rgba(212,168,83,0.2)] outline-none transition-all text-sm font-cairo"
													/>
												</div>
											</div>
											<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
												<div>
													<label className="block text-sm font-cairo font-semibold text-[#111111] mb-1.5">
														{t('seller.stockLabel', 'Stock')} *
													</label>
													<input
														type="number"
														placeholder="٠"
														className="w-full px-4 py-3 rounded-xl border border-[#AAAAAA] focus:border-[#D4A853] focus:ring-2 focus:ring-[rgba(212,168,83,0.2)] outline-none transition-all text-sm font-cairo"
													/>
												</div>
												<div>
													<label className="block text-sm font-cairo font-semibold text-[#111111] mb-1.5">
														SKU
													</label>
													<input
														type="text"
														placeholder={t(
															'seller.skuPlaceholder',
															'Product SKU',
														)}
														className="w-full px-4 py-3 rounded-xl border border-[#AAAAAA] focus:border-[#D4A853] focus:ring-2 focus:ring-[rgba(212,168,83,0.2)] outline-none transition-all text-sm font-cairo"
													/>
												</div>
											</div>
											<div>
												<label className="block text-sm font-cairo font-semibold text-[#111111] mb-1.5">
													{t('seller.barcodeLabel', 'Barcode')}
												</label>
												<input
													type="text"
													placeholder={t(
														'seller.barcodePlaceholder',
														'Or scan with scanner',
													)}
													className="w-full px-4 py-3 rounded-xl border border-[#AAAAAA] focus:border-[#D4A853] focus:ring-2 focus:ring-[rgba(212,168,83,0.2)] outline-none transition-all text-sm font-cairo"
												/>
											</div>
										</div>
									)}

									{step === 4 && (
										<div className="max-w-2xl space-y-4">
											<p className="text-sm text-[#6B6B6B] font-cairo">
												{t(
													'seller.variantHelpText',
													'Add variants like color and size',
												)}
											</p>
											<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
												<div>
													<label className="block text-sm font-cairo font-semibold text-[#111111] mb-1.5">
														{t(
															'seller.variantNameLabel',
															'Variant name',
														)}
													</label>
													<select
														aria-label={t(
															'seller.variantName',
															'Variant name',
														)}
														className="w-full px-4 py-3 rounded-xl border border-[#AAAAAA] focus:border-[#D4A853] focus:ring-2 focus:ring-[rgba(212,168,83,0.2)] outline-none transition-all text-sm font-cairo bg-white"
													>
														<option>
															{t(
																'seller.selectVariant',
																'Select variant',
															)}
														</option>
														<option>
															{t('seller.variantColor', 'Color')}
														</option>
														<option>
															{t('seller.variantSize', 'Size')}
														</option>
														<option>
															{t(
																'seller.variantMaterial',
																'Material',
															)}
														</option>
													</select>
												</div>
												<div>
													<label className="block text-sm font-cairo font-semibold text-[#111111] mb-1.5">
														القيم (مفصولة بفاصلة)
													</label>
													<input
														type="text"
														placeholder={t(
															'seller.variantValuesPlaceholder',
															'red, blue, green',
														)}
														className="w-full px-4 py-3 rounded-xl border border-[#AAAAAA] focus:border-[#D4A853] focus:ring-2 focus:ring-[rgba(212,168,83,0.2)] outline-none transition-all text-sm font-cairo"
													/>
												</div>
											</div>
											<div className="border border-[#F3EDE4] rounded-xl overflow-hidden mt-4">
												<table className="w-full text-xs">
													<thead className="bg-[#F8F8F8]">
														<tr>
															<th className="px-3 py-2 font-cairo font-semibold text-[#6B6B6B]">
																{t(
																	'seller.variantNameLabel',
																	'Variant',
																)}
															</th>
															<th className="px-3 py-2 font-cairo font-semibold text-[#6B6B6B]">
																{t('seller.priceLabel', 'Price')}
															</th>
															<th className="px-3 py-2 font-cairo font-semibold text-[#6B6B6B]">
																{t('seller.stockLabel', 'Stock')}
															</th>
															<th className="px-3 py-2 font-cairo font-semibold text-[#6B6B6B]">
																SKU
															</th>
														</tr>
													</thead>
													<tbody>
														<tr className="border-t border-[#F3EDE4]">
															<td className="px-3 py-2 font-cairo">
																أسود / M
															</td>
															<td className="px-3 py-2">
																<input
																	type="text"
																	defaultValue="٤٥,٠٠٠"
																	className="w-20 px-2 py-1 rounded-lg border border-[#F3EDE4] text-xs font-cairo"
																/>
															</td>
															<td className="px-3 py-2">
																<input
																	type="number"
																	defaultValue={15}
																	className="w-16 px-2 py-1 rounded-lg border border-[#F3EDE4] text-xs font-cairo"
																/>
															</td>
															<td className="px-3 py-2">
																<input
																	type="text"
																	defaultValue="SKU-001-B-M"
																	className="w-24 px-2 py-1 rounded-lg border border-[#F3EDE4] text-xs font-cairo"
																/>
															</td>
														</tr>
														<tr className="border-t border-[#F3EDE4]">
															<td className="px-3 py-2 font-cairo">
																أسود / L
															</td>
															<td className="px-3 py-2">
																<input
																	type="text"
																	defaultValue="٤٥,٠٠٠"
																	className="w-20 px-2 py-1 rounded-lg border border-[#F3EDE4] text-xs font-cairo"
																/>
															</td>
															<td className="px-3 py-2">
																<input
																	type="number"
																	defaultValue={9}
																	className="w-16 px-2 py-1 rounded-lg border border-[#F3EDE4] text-xs font-cairo"
																/>
															</td>
															<td className="px-3 py-2">
																<input
																	type="text"
																	defaultValue="SKU-001-B-L"
																	className="w-24 px-2 py-1 rounded-lg border border-[#F3EDE4] text-xs font-cairo"
																/>
															</td>
														</tr>
													</tbody>
												</table>
											</div>
										</div>
									)}

									{step === 5 && (
										<div className="space-y-4 max-w-2xl">
											<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
												<div>
													<label className="block text-sm font-cairo font-semibold text-[#111111] mb-1.5">
														الوزن (كجم)
													</label>
													<input
														type="number"
														step="0.1"
														placeholder="٠"
														className="w-full px-4 py-3 rounded-xl border border-[#AAAAAA] focus:border-[#D4A853] focus:ring-2 focus:ring-[rgba(212,168,83,0.2)] outline-none transition-all text-sm font-cairo"
													/>
												</div>
												<div>
													<label className="block text-sm font-cairo font-semibold text-[#111111] mb-1.5">
														الطول (سم)
													</label>
													<input
														type="number"
														placeholder="٠"
														className="w-full px-4 py-3 rounded-xl border border-[#AAAAAA] focus:border-[#D4A853] focus:ring-2 focus:ring-[rgba(212,168,83,0.2)] outline-none transition-all text-sm font-cairo"
													/>
												</div>
												<div>
													<label className="block text-sm font-cairo font-semibold text-[#111111] mb-1.5">
														{t('seller.widthCm', 'Width (cm)')}
													</label>
													<input
														type="number"
														placeholder="٠"
														className="w-full px-4 py-3 rounded-xl border border-[#AAAAAA] focus:border-[#D4A853] focus:ring-2 focus:ring-[rgba(212,168,83,0.2)] outline-none transition-all text-sm font-cairo"
													/>
												</div>
											</div>
											<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
												<div>
													<label className="block text-sm font-cairo font-semibold text-[#111111] mb-1.5">
														{t('seller.heightCm', 'Height (cm)')}
													</label>
													<input
														type="number"
														placeholder="٠"
														className="w-full px-4 py-3 rounded-xl border border-[#AAAAAA] focus:border-[#D4A853] focus:ring-2 focus:ring-[rgba(212,168,83,0.2)] outline-none transition-all text-sm font-cairo"
													/>
												</div>
												<div>
													<label className="block text-sm font-cairo font-semibold text-[#111111] mb-1.5">
														فئة الشحن
													</label>
													<select
														aria-label={t(
															'seller.shippingClassLabel',
															'Shipping class',
														)}
														className="w-full px-4 py-3 rounded-xl border border-[#AAAAAA] focus:border-[#D4A853] focus:ring-2 focus:ring-[rgba(212,168,83,0.2)] outline-none transition-all text-sm font-cairo bg-white"
													>
														<option>
															{t(
																'seller.shippingStandard',
																'Standard shipping',
															)}
														</option>
														<option>
															{t(
																'seller.shippingExpress',
																'Express shipping',
															)}
														</option>
														<option>
															{t(
																'seller.shippingFree',
																'Free shipping',
															)}
														</option>
													</select>
												</div>
											</div>
										</div>
									)}

									{step === 6 && (
										<div className="max-w-2xl space-y-4">
											<div className="p-4 rounded-xl bg-[rgba(16,185,129,0.08)] border border-[rgba(16,185,129,0.2)]">
												<h3 className="text-sm font-cairo font-semibold text-[#10B981] mb-2 flex items-center gap-2">
													<Check className="w-4 h-4" strokeWidth={2} />
													{t('seller.readyToPublish', 'Ready to publish')}
												</h3>
												<p className="text-xs text-[#6B6B6B] font-cairo">
													{t(
														'seller.reviewBeforePublish',
														'Review product info before publishing',
													)}
												</p>
											</div>
											<div className="space-y-3">
												{[
													{
														label: t(
															'seller.reviewProductName',
															'Product name',
														),
														value: 'ساعة ذكية أبل واتش سلسلة ٩',
													},
													{
														label: t(
															'seller.categoryLabel',
															'Category',
														),
														value: 'إلكترونيات',
													},
													{
														label: t('seller.priceLabel', 'Price'),
														value: '٤٥,٠٠٠ ر.ي',
													},
													{
														label: t('seller.stockLabel', 'Stock'),
														value: '٢٤ وحدة',
													},
													{
														label: t('seller.reviewStatus', 'Status'),
														value: 'نشط',
													},
												].map((field, i) => (
													<div
														key={i}
														className="flex justify-between items-center py-2 border-b border-[#F3EDE4] last:border-0"
													>
														<span className="text-xs font-cairo font-semibold text-[#6B6B6B]">
															{field.label}
														</span>
														<span className="text-xs font-cairo text-[#111111]">
															{field.value}
														</span>
													</div>
												))}
											</div>
										</div>
									)}
								</motion.div>
							</AnimatePresence>
						</div>

						{/* Wizard Footer */}
						<div className="shrink-0 px-6 py-4 border-t border-[#F3EDE4] flex items-center justify-between">
							<button
								onClick={handlePrev}
								disabled={step === 1}
								className={cn(
									'px-4 py-2.5 rounded-xl text-sm font-cairo font-semibold transition-colors',
									step === 1
										? 'text-[#AAAAAA] cursor-not-allowed'
										: 'text-[#111111] hover:bg-[#F8F8F8]',
								)}
							>
								<span className="flex items-center gap-1">
									<ChevronRight className="w-4 h-4" strokeWidth={1.5} />
									{t('seller.prevStep', 'Previous')}
								</span>
							</button>
							<div className="flex items-center gap-2">
								<button
									onClick={onClose}
									className="px-4 py-2.5 rounded-xl border border-[#F3EDE4] text-sm font-cairo font-semibold text-[#6B6B6B] hover:bg-[#F8F8F8] transition-colors hidden sm:block"
								>
									{t('seller.saveDraft', 'Save Draft')}
								</button>
								<button
									onClick={handleNext}
									className={cn(
										'px-6 py-2.5 rounded-xl text-sm font-cairo font-semibold transition-colors',
										step === 6
											? 'bg-[#10B981] text-white hover:bg-[#0da271]'
											: 'bg-[#D4A853] text-[#1A1612] hover:bg-[#c49a48]',
									)}
								>
									<span className="flex items-center gap-1">
										{step === 6
											? t('seller.publishProduct', 'Publish Product')
											: t('seller.next', 'Next')}
										{step < 6 && (
											<ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
										)}
									</span>
								</button>
							</div>
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function SellerProducts() {
	const { t } = useTranslation();
	const [view, setView] = useState<'grid' | 'list'>('grid');
	const [search, setSearch] = useState('');
	const [category, setCategory] = useState('');
	const [statusFilter, setStatusFilter] = useState('all');
	const [sortBy, setSortBy] = useState('newest');
	const [wizardOpen, setWizardOpen] = useState(false);

	/* ── Hooks ── */
	const { addToast } = useApp();
	const { data: sellerProductsResponse, refetch: refetchSellerProducts } =
		useSellerProducts();

	/* ── Effects: map API data ── */
	const apiProducts = useMemo<Product[]>(() => {
		const resp = sellerProductsResponse as unknown as
			| { items?: unknown[] }
			| null;
		const items: unknown[] = resp?.items ?? [];
		return items.map((row): Product => {
			const r = row as Record<string, unknown>;
			const stock = Number(r.stock ?? 0);
			return {
				id: Number(r.id ?? 0),
				name:
					String(r.name_ar ?? r.name_en ?? r.name ?? '') || `#${r.id}`,
				price: String(r.price ?? '0'),
				stock,
				status: stock === 0 ? 'out' : stock < 10 ? 'low' : 'active',
				views: Number(r.views ?? 0),
				orders: Number(r.sold_count ?? r.orders ?? 0),
				image: String(r.main_image ?? ''),
				category: String(r.category_id ?? ''),
			};
		});
	}, [sellerProductsResponse]);

	const dataProducts = apiProducts;

	/* ── Derived: filter & sort ── */
	const filtered = dataProducts.filter((p) => {
		const matchesSearch =
			p.name.toLowerCase().includes(search.toLowerCase()) || p.price.includes(search);
		const matchesCategory = category === 'all' || p.category === category;
		const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
		return matchesSearch && matchesCategory && matchesStatus;
	});

	const sorted = [...filtered].sort((a, b) => {
		if (sortBy === 'newest') return b.id - a.id;
		if (sortBy === 'orders') return b.orders - a.orders;
		if (sortBy === 'price')
			return (
				parseInt(a.price.replace(/[^0-9]/g, '')) - parseInt(b.price.replace(/[^0-9]/g, ''))
			);
		return 0;
	});

/* ── Handlers ── */
const deleteProduct = useCallback(
	async (id: number) => {
		try {
			await deleteSellerProduct(id);
			addToast({ type: 'success', message: 'تم حذف المنتج' });
			await refetchSellerProducts();
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			addToast({ type: 'error', message: 'فشل حذف المنتج: ' + msg });
		}
	},
	[addToast, refetchSellerProducts],
);

	return (
		<DashboardShell
			title={t('seller.products', 'Products')}
			breadcrumb={t('seller.breadcrumbProducts', 'Dashboard / Products')}
		>
			<div className="space-y-6">
				{/* Page Header */}
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div>
						<h1 className="text-2xl font-amiri font-bold text-[#1A1612]">
							{t('seller.products', 'Products')}
						</h1>
						<p className="text-sm text-[#6B6B6B] font-cairo">
							{t('seller.productsSubtitle', 'Manage and add products to your store')}
						</p>
					</div>
					<div className="flex items-center gap-2 flex-wrap">
						<button
							onClick={() => setWizardOpen(true)}
							className="flex items-center gap-2 px-4 py-2.5 bg-[#D4A853] hover:bg-[#c49a48] text-[#1A1612] rounded-xl text-sm font-cairo font-semibold transition-colors"
						>
							<Plus className="w-4 h-4" strokeWidth={1.5} />
							{t('seller.addNewProduct', 'Add New Product')}
						</button>
						<button className="flex items-center gap-2 px-4 py-2.5 border border-[#D4A853] text-[#D4A853] hover:bg-[#F3EDE4] rounded-xl text-sm font-cairo font-semibold transition-colors">
							<Upload className="w-4 h-4" strokeWidth={1.5} />
							{t('seller.export', 'Export')}
						</button>
						<button className="flex items-center gap-2 px-4 py-2.5 border border-[#D4A853] text-[#D4A853] hover:bg-[#F3EDE4] rounded-xl text-sm font-cairo font-semibold transition-colors">
							<Download className="w-4 h-4" strokeWidth={1.5} />
							{t('seller.import', 'Import')}
						</button>
					</div>
				</div>

				{/* Toolbar */}
				<div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
					<div className="flex flex-col md:flex-row md:items-center gap-3 flex-wrap">
						{/* Search */}
						<div className="relative flex-1 min-w-[200px] max-w-md">
							<Search
								className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AAAAAA]"
								strokeWidth={1.5}
							/>
							<input
								type="text"
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								placeholder={t(
									'seller.searchProductPlaceholder',
									'Search products...',
								)}
								className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-[#F3EDE4] focus:border-[#D4A853] focus:ring-2 focus:ring-[rgba(212,168,83,0.2)] outline-none transition-all text-sm font-cairo"
							/>
						</div>

						{/* Category Filter */}
						<select
							value={category}
							onChange={(e) => setCategory(e.target.value)}
							aria-label={t('seller.categoryLabel', 'Category')}
							className="px-3 py-2.5 rounded-xl border border-[#F3EDE4] focus:border-[#D4A853] outline-none text-sm font-cairo bg-white"
						>
							{CATEGORY_KEYS.map((c) => (
								<option key={c.key} value={c.key}>
									{t(c.labelKey)}
								</option>
							))}
						</select>

						{/* Status Filter */}
						<div className="flex items-center gap-1 bg-[#F8F8F8] rounded-xl p-1 overflow-x-auto">
							{STATUS_FILTER_KEYS.map((f) => (
								<button
									key={f.key}
									onClick={() => setStatusFilter(f.key)}
									className={cn(
										'px-3 py-1.5 rounded-lg text-xs font-cairo font-semibold transition-all whitespace-nowrap',
										statusFilter === f.key
											? 'bg-[#D4A853] text-[#1A1612]'
											: 'text-[#6B6B6B] hover:text-[#111111]',
									)}
								>
									{t(f.labelKey)}
								</button>
							))}
						</div>

						{/* Sort */}
						<select
							value={sortBy}
							onChange={(e) => setSortBy(e.target.value)}
							aria-label={t('common.sortBy', 'Sort by')}
							className="px-3 py-2.5 rounded-xl border border-[#F3EDE4] focus:border-[#D4A853] outline-none text-sm font-cairo bg-white"
						>
							<option value="newest">{t('seller.sortNewest', 'Newest')}</option>
							<option value="orders">
								{t('seller.sortBestSelling', 'Best selling')}
							</option>
							<option value="price">{t('seller.sortPrice', 'Price')}</option>
						</select>

						{/* View Toggle */}
						<div className="flex items-center gap-1 bg-[#F8F8F8] rounded-xl p-1 mr-auto">
							<button
								onClick={() => setView('grid')}
								title={t('seller.viewGrid', 'Grid view')}
								aria-label={t('seller.viewGrid', 'Grid view')}
								className={cn(
									'w-9 h-9 rounded-lg flex items-center justify-center transition-colors',
									view === 'grid'
										? 'bg-white shadow-sm text-[#D4A853]'
										: 'text-[#AAAAAA] hover:text-[#111111]',
								)}
							>
								<Grid3X3 className="w-4 h-4" strokeWidth={1.5} />
							</button>
							<button
								onClick={() => setView('list')}
								title={t('seller.viewList', 'List view')}
								aria-label={t('seller.viewList', 'List view')}
								className={cn(
									'w-9 h-9 rounded-lg flex items-center justify-center transition-colors',
									view === 'list'
										? 'bg-white shadow-sm text-[#D4A853]'
										: 'text-[#AAAAAA] hover:text-[#111111]',
								)}
							>
								<List className="w-4 h-4" strokeWidth={1.5} />
							</button>
						</div>
					</div>
				</div>

				{/* Products Grid View */}
				{view === 'grid' && (
					<div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
						{sorted.map((product) => (
							<motion.div
								key={product.id}
								layout
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -20 }}
								className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group"
							>
								{/* Image */}
								<div className="relative aspect-square bg-gradient-to-br from-[#F3EDE4] to-[#E8DFD0] flex items-center justify-center overflow-hidden">
									<Package className="w-10 h-10 text-[#D4A853]" strokeWidth={1} />
									<div className="absolute top-3 right-3">
										<StatusBadge status={product.status} />
									</div>
									{/* Hover Actions */}
									<div className="absolute inset-x-0 bottom-0 p-3 flex items-center justify-center gap-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-200">
										<button
											title={t('common.edit', 'Edit')}
											aria-label={t('common.edit', 'Edit')}
											className="w-8 h-8 rounded-lg bg-white/90 hover:bg-white flex items-center justify-center transition-colors"
										>
											<Edit3
												className="w-3.5 h-3.5 text-[#111111]"
												strokeWidth={1.5}
											/>
										</button>
										<button
											onClick={() => deleteProduct(product.id)}
											title={t('common.delete', 'Delete')}
											aria-label={t('common.delete', 'Delete')}
											className="w-8 h-8 rounded-lg bg-white/90 hover:bg-white flex items-center justify-center transition-colors"
										>
											<Trash2
												className="w-3.5 h-3.5 text-[#EF4444]"
												strokeWidth={1.5}
											/>
										</button>
										<button
											title={t('seller.view', 'View')}
											aria-label={t('seller.view', 'View')}
											className="w-8 h-8 rounded-lg bg-white/90 hover:bg-white flex items-center justify-center transition-colors"
										>
											<Eye
												className="w-3.5 h-3.5 text-[#111111]"
												strokeWidth={1.5}
											/>
										</button>
									</div>
								</div>
								{/* Info */}
								<div className="p-3 space-y-2">
									<h3 className="text-xs font-cairo font-semibold text-[#111111] line-clamp-2 leading-relaxed min-h-[2.5rem]">
										{product.name}
									</h3>
									<div className="flex items-center justify-between">
										<span className="text-sm font-bold font-mono text-[#D4A853]">
											{product.price} ر.ي
										</span>
										<span className="text-[10px] text-[#6B6B6B] font-cairo">
											{product.stock} {t('seller.inStock', 'in stock')}
										</span>
									</div>
									<div className="flex items-center gap-3 text-[10px] text-[#6B6B6B] font-cairo">
										<span className="flex items-center gap-1">
											<Eye className="w-3 h-3" strokeWidth={1.5} />
											{product.views}
										</span>
										<span className="flex items-center gap-1">
											<ShoppingBag className="w-3 h-3" strokeWidth={1.5} />
											{product.orders}
										</span>
									</div>
								</div>
							</motion.div>
						))}
					</div>
				)}

				{/* Products List View */}
				{view === 'list' && (
					<div className="bg-white rounded-2xl shadow-sm overflow-hidden overflow-x-auto">
						<table className="w-full min-w-[800px]">
							<thead>
								<tr className="text-right bg-[#F8F8F8]">
									<th className="px-4 py-3 text-[11px] font-semibold text-[#6B6B6B] font-cairo">
										{t('seller.thImage', 'Image')}
									</th>
									<th className="px-4 py-3 text-[11px] font-semibold text-[#6B6B6B] font-cairo">
										{t('seller.thProductName', 'Product name')}
									</th>
									<th className="px-4 py-3 text-[11px] font-semibold text-[#6B6B6B] font-cairo">
										{t('seller.thPrice', 'Price')}
									</th>
									<th className="px-4 py-3 text-[11px] font-semibold text-[#6B6B6B] font-cairo">
										{t('seller.thStock', 'Stock')}
									</th>
									<th className="px-4 py-3 text-[11px] font-semibold text-[#6B6B6B] font-cairo">
										{t('seller.thStatus', 'Status')}
									</th>
									<th className="px-4 py-3 text-[11px] font-semibold text-[#6B6B6B] font-cairo">
										{t('seller.thSales', 'Sales')}
									</th>
									<th className="px-4 py-3 text-[11px] font-semibold text-[#6B6B6B] font-cairo">
										{t('seller.thActions', 'Actions')}
									</th>
								</tr>
							</thead>
							<tbody>
								{sorted.map((product) => (
									<motion.tr
										key={product.id}
										layout
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										exit={{ opacity: 0 }}
										className="border-b border-[#F3EDE4]/50 hover:bg-[#F8F8F8] transition-colors"
									>
										<td className="px-4 py-3">
											<div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F3EDE4] to-[#E8DFD0] flex items-center justify-center">
												<Package
													className="w-4 h-4 text-[#D4A853]"
													strokeWidth={1}
												/>
											</div>
										</td>
										<td className="px-4 py-3 text-xs font-cairo font-semibold text-[#111111]">
											{product.name}
										</td>
										<td className="px-4 py-3 text-xs font-mono text-[#111111] font-semibold">
											{product.price} ر.ي
										</td>
										<td className="px-4 py-3 text-xs font-mono text-[#6B6B6B]">
											{product.stock}
										</td>
										<td className="px-4 py-3">
											<StatusBadge status={product.status} />
										</td>
										<td className="px-4 py-3 text-xs font-mono text-[#6B6B6B]">
											{product.orders}
										</td>
										<td className="px-4 py-3">
											<div className="flex items-center gap-1">
												<button
													title={t('common.edit', 'Edit')}
													aria-label={t('common.edit', 'Edit')}
													className="w-7 h-7 rounded-lg hover:bg-[#F3EDE4] flex items-center justify-center transition-colors"
												>
													<Edit3
														className="w-3.5 h-3.5 text-[#6B6B6B]"
														strokeWidth={1.5}
													/>
												</button>
												<button
													onClick={() => deleteProduct(product.id)}
													title={t('common.delete', 'Delete')}
													aria-label={t('common.delete', 'Delete')}
													className="w-7 h-7 rounded-lg hover:bg-[rgba(239,68,68,0.1)] flex items-center justify-center transition-colors"
												>
													<Trash2
														className="w-3.5 h-3.5 text-[#EF4444]"
														strokeWidth={1.5}
													/>
												</button>
												<button
													title={t('seller.view', 'View')}
													aria-label={t('seller.view', 'View')}
													className="w-7 h-7 rounded-lg hover:bg-[#F3EDE4] flex items-center justify-center transition-colors"
												>
													<Eye
														className="w-3.5 h-3.5 text-[#6B6B6B]"
														strokeWidth={1.5}
													/>
												</button>
											</div>
										</td>
									</motion.tr>
								))}
							</tbody>
						</table>
					</div>
				)}

				{/* Empty State */}
				{sorted.length === 0 && (
					<div className="bg-white rounded-2xl p-12 text-center">
						<div className="w-20 h-20 rounded-2xl bg-[#F3EDE4] flex items-center justify-center mx-auto mb-4">
							<Package className="w-8 h-8 text-[#D4A853]" strokeWidth={1.5} />
						</div>
						<h3 className="text-base font-amiri font-bold text-[#111111] mb-1">
							{t('seller.noProducts', 'No products')}
						</h3>
						<p className="text-sm text-[#6B6B6B] font-cairo mb-4">
							{t('seller.noProductsMatch', 'No products match your search criteria')}
						</p>
						<button
							onClick={() => {
								setSearch('');
								setCategory('all');
								setStatusFilter('all');
							}}
							className="px-4 py-2.5 bg-[#D4A853] text-[#1A1612] rounded-xl text-sm font-cairo font-semibold hover:bg-[#c49a48] transition-colors"
						>
							{t('seller.resetFilters', 'Reset filters')}
						</button>
					</div>
				)}
			</div>

			{/* Add Product Wizard */}
			<AddProductWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
		</DashboardShell>
	);
}
