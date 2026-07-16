/**
 * Deals carousel — Phase 5.
 *
 * Horizontal scroller that renders the deal products from
 * /api/stats/home. Each card is a ProductCard (variant=card).
 */
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { ProductCard, type ProductCardData } from '@/features/products/components/ProductCard';

interface Props {
	products: ProductCardData[];
}

export function DealsCarousel({ products }: Props) {
	const { t } = useTranslation();
	if (!products.length) return null;
	return (
		<View className="py-6">
			<Text className="px-6 text-lg font-bold text-slate-900 mb-3">{t('home.deals')}</Text>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={{ paddingHorizontal: 24 }}
			>
				{products.map((p) => (
					<ProductCard key={p.id} product={p} />
				))}
			</ScrollView>
		</View>
	);
}