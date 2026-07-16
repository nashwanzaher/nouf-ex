/**
 * Product card — Phase 5.
 *
 * Reused by the Home page (deals + featured), Search results, and
 * the Store page. Rendered with NativeWind; image falls back to a
 * coloured placeholder if the URL is missing or fails to load.
 */
import { useTranslation } from 'react-i18next';
import { Pressable, View, Text, Image } from 'react-native';
import { Link } from 'expo-router';

export interface ProductCardData {
	id: number;
	name_ar: string;
	name_en: string | null;
	name_zh: string | null;
	price: number;
	original_price?: number | null;
	currency: string;
	main_image: string | null;
	rating?: number;
}

interface Props {
	product: ProductCardData;
	variant?: 'card' | 'wide';
}

function localizedName(p: ProductCardData, lang: string): string {
	if (lang === 'ar') return p.name_ar;
	if (lang === 'zh' && p.name_zh) return p.name_zh;
	return p.name_en ?? p.name_ar;
}

function formatPrice(value: number, currency: string, lang: string): string {
	try {
		return new Intl.NumberFormat(lang === 'zh' ? 'zh' : lang, {
			style: 'currency',
			currency,
			maximumFractionDigits: 0,
		}).format(value);
	} catch {
		return `${value} ${currency}`;
	}
}

export function ProductCard({ product, variant = 'card' }: Props) {
	const { t, i18n } = useTranslation();
	const name = localizedName(product, i18n.language);
	const onSale =
		product.original_price != null && product.original_price > product.price;
	const discountPct = onSale
		? Math.round(((product.original_price! - product.price) / product.original_price!) * 100)
		: 0;

	if (variant === 'wide') {
		return (
			<Link href={`/product/${product.id}`} asChild>
				<Pressable className="bg-white rounded-xl p-3 mb-3 flex-row shadow-sm">
					<View className="w-20 h-20 rounded-lg bg-slate-100 overflow-hidden mr-3">
						{product.main_image ? (
							<Image
								source={{ uri: product.main_image }}
								className="w-full h-full"
								resizeMode="cover"
							/>
						) : null}
					</View>
					<View className="flex-1">
						<Text numberOfLines={2} className="text-sm font-medium text-slate-900">
							{name}
						</Text>
						<View className="flex-row items-center mt-2">
							<Text className="text-base font-bold text-primary-600">
								{formatPrice(product.price, product.currency, i18n.language)}
							</Text>
							{onSale ? (
								<Text className="ml-2 text-xs text-slate-400 line-through">
									{formatPrice(product.original_price!, product.currency, i18n.language)}
								</Text>
							) : null}
						</View>
					</View>
				</Pressable>
			</Link>
		);
	}

	return (
		<Link href={`/product/${product.id}`} asChild>
			<Pressable className="bg-white rounded-xl overflow-hidden shadow-sm mr-3 w-44">
				<View className="w-full h-44 bg-slate-100">
					{product.main_image ? (
						<Image
							source={{ uri: product.main_image }}
							className="w-full h-full"
							resizeMode="cover"
						/>
					) : null}
					{onSale ? (
						<View className="absolute top-2 left-2 bg-red-500 px-2 py-1 rounded">
							<Text className="text-white text-xs font-bold">-{discountPct}%</Text>
						</View>
					) : null}
				</View>
				<View className="p-3">
					<Text numberOfLines={2} className="text-sm font-medium text-slate-900 h-10">
						{name}
					</Text>
					<View className="mt-2">
						<Text className="text-base font-bold text-primary-600">
							{formatPrice(product.price, product.currency, i18n.language)}
						</Text>
						{onSale ? (
							<Text className="text-xs text-slate-400 line-through">
								{formatPrice(product.original_price!, product.currency, i18n.language)}
							</Text>
						) : null}
					</View>
				</View>
			</Pressable>
		</Link>
	);
}