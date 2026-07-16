/**
 * Featured products grid — Phase 5.
 *
 * Vertical list of featured products (variant=wide) for the home page.
 */
import { useTranslation } from 'react-i18next';
import { View, Text } from 'react-native';
import { ProductCard, type ProductCardData } from '@/features/products/components/ProductCard';

interface Props {
	products: ProductCardData[];
}

export function FeaturedProducts({ products }: Props) {
	const { t } = useTranslation();
	if (!products.length) return null;
	return (
		<View className="px-6 py-6">
			<Text className="text-lg font-bold text-slate-900 mb-3">{t('home.featured')}</Text>
			{products.map((p) => (
				<ProductCard key={p.id} product={p} variant="wide" />
			))}
		</View>
	);
}