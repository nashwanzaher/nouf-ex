import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCart } from '@/features/cart/context/CartContext';
import type { Product } from '@/hooks/useApi';
import {
	renderPriceBlock,
	discountPercent,
	formatDiscountLabel,
	safeImageUrl,
} from '@/lib/utils/safe-format';
import { formatMoney } from '@/lib/format';
import {
	ShoppingCart,
	Star,
	Heart,
	Eye,
} from 'lucide-react';

interface ProductCardProps {
	product: Product;
	lang: string;
	compact?: boolean;
	onAdd?: () => void;
}

function getProductName(p: Product, lang: string) {
	return lang === 'en' ? p.name_en : lang === 'zh' ? p.name_zh : p.name_ar;
}

export default function ProductCard({
	product,
	lang,
	compact = false,
	onAdd,
}: ProductCardProps) {
	const { t, i18n } = useTranslation();
	const { dispatch } = useCart();
	const currentLang = lang || i18n.language;
	const name = getProductName(product, currentLang);
	const prices = renderPriceBlock(
		{
			price: product.price,
			original_price: product.original_price,
			currency: product.currency,
		},
		formatMoney,
	);
	const pct = discountPercent(product.price, product.original_price);
	const discount = formatDiscountLabel(pct, (k: string) => k);
	const img = safeImageUrl(product.main_image, { kind: 'product' });
	const added = false; // Could use local state for this

	const handleAddToCart = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		dispatch({
			type: 'ADD',
			payload: {
				productId: String(product.id),
				name: getProductName(product, i18n.language),
				price: product.price,
				quantity: 1,
				image: product.main_image,
				merchantName: '',
			},
		});
		onAdd?.();
	};

	if (compact) {
		return (
			<Link
				to={`/product/${product.id}`}
				className="bg-white rounded-lg border border-aliBorder overflow-hidden hover:shadow-md hover:border-aliOrange/30 transition-all group"
			>
				<div className="relative aspect-square overflow-hidden bg-aliSurface">
					<img
						src={img}
						alt={name}
						className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
						loading="lazy"
					/>
					{product.badges?.includes('bestseller') && (
						<span className="absolute top-2 right-2 bg-aliOrange text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
							{t('product.badge.bestseller')}
						</span>
					)}
					{product.badges?.includes('new') && (
						<span className="absolute top-2 left-2 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
							{t('product.badge.new')}
						</span>
					)}
					{pct > 0 && (
						<span className="absolute bottom-2 right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
							{discount}
						</span>
					)}
				</div>
				<div className="p-2.5">
					<h3 className="text-sm text-aliText line-clamp-2 leading-snug hover:text-aliOrange transition-colors min-h-[2.5em]">
						{name}
					</h3>
					<div className="mt-1.5 flex items-baseline gap-1.5">
						<span className="text-aliOrange font-bold text-base" title={prices.current}>
							{prices.current}
						</span>
						{prices.original && (
							<span className="text-aliTextMute text-xs line-through" title={prices.original}>
								{prices.original}
							</span>
						)}
					</div>
					<div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
						<span className="text-[10px] bg-aliSurface text-aliTextSec px-1.5 py-0.5 rounded">
							{t('home.moqBadge', { count: product.moq || 1, defaultValue: `MOQ: ${product.moq || 1} pcs` })}
						</span>
						<span className="text-[10px] text-aliTextMute">
							{product.sold_count} {t('home.soldSuffix', 'sold')}
						</span>
					</div>
				</div>
			</Link>
		);
	}

	return (
		<div className="bg-white rounded-lg border border-aliBorder overflow-hidden hover:shadow-md hover:border-aliOrange/30 transition-all group">
			<Link
				to={`/product/${product.id}`}
				className="block relative aspect-square overflow-hidden bg-aliSurface"
			>
				<img
					src={img}
					alt={name}
					className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
					loading="lazy"
				/>
				{product.badges?.includes('bestseller') && (
					<span className="absolute top-2 right-2 bg-aliOrange text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
						{t('product.badge.bestseller')}
					</span>
				)}
				{product.badges?.includes('new') && (
					<span className="absolute top-2 left-2 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
						{t('product.badge.new')}
					</span>
				)}
				{pct > 0 && (
					<span className="absolute bottom-2 right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
						{discount}
					</span>
				)}

				{/* Quick Actions Overlay */}
				<div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1.5">
					<button
						type="button"
						onClick={handleAddToCart}
						className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center hover:bg-white hover:shadow-lg transition-all"
						aria-label={t('product.addToCart.idle')}
					>
						<ShoppingCart size={14} className="text-aliOrange" />
					</button>
					<button
						type="button"
						className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center hover:bg-white hover:shadow-lg transition-all"
						aria-label={t('product.wishlist')}
					>
						<Heart size={14} className="text-gray-500" />
					</button>
				</div>
			</Link>

			<div className="p-2.5">
				<Link to={`/product/${product.id}`}>
					<h3 className="text-sm text-aliText line-clamp-2 leading-snug hover:text-aliOrange transition-colors min-h-[2.5em]">
						{name}
					</h3>
				</Link>
				<div className="mt-1.5 flex items-baseline gap-1.5">
					<span className="text-aliOrange font-bold text-base" title={prices.current}>
						{prices.current}
					</span>
					{prices.original && (
						<span className="text-aliTextMute text-xs line-through" title={prices.original}>
							{prices.original}
						</span>
					)}
				</div>

				<div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
					<span className="text-[10px] bg-aliSurface text-aliTextSec px-1.5 py-0.5 rounded">
						{t('home.moqBadge', { count: product.moq || 1, defaultValue: `MOQ: ${product.moq || 1} pcs` })}
					</span>
					<span className="text-[10px] text-aliTextMute">
						{product.sold_count} {t('home.soldSuffix', 'sold')}
					</span>
{product.rating > 0 && (
					<span className="flex items-center gap-0.5 text-[10px] text-amber-500">
						<Star size={10} className="fill-amber-500" />
						{product.rating.toFixed(1)}
					</span>
				)}
			</div>

			<div className="flex items-center gap-1.5 mt-2.5">
					<button
						type="button"
						onClick={handleAddToCart}
						className={`flex-1 h-8 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
							added
								? 'bg-green-500 text-white'
								: 'bg-aliOrange text-white hover:bg-aliOrangeHover'
						}`}
						aria-label={added ? t('product.addToCart.added') : t('product.addToCart.idle')}
					>
						<ShoppingCart size={12} />
						{added ? t('product.addToCart.added') : t('product.addToCart.idle')}
					</button>
					<Link
						to={`/product/${product.id}`}
						className="w-8 h-8 rounded border border-aliBorder flex items-center justify-center hover:bg-aliSurface hover:border-aliOrange/30 transition-all"
						aria-label={t('product.viewDetails')}
					>
						<Eye size={14} className="text-aliTextMute" />
					</Link>
				</div>
			</div>
		</div>
	);
}