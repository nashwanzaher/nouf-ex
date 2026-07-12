/**
 * Products / catalog feature public surface.
 */
export { default as Categories } from './components/Categories';
export { default as Deals } from './components/Deals';
export { default as ProductDetail } from './components/ProductDetail';
export { default as SearchResults } from './components/SearchResults';
export { default as StorePage } from './components/StorePage';

export {
	getCategories,
	getCategory,
	getDeals,
	getFeaturedProducts,
	getProduct,
	getProducts,
	getStore,
	getStoreReviews,
	getStores,
	searchProducts,
} from './api/products';

export type {
	Product,
	ProductFilters,
	ProductImage,
	ProductWithDetails,
	Category,
	CategoryWithProducts,
	Review,
	Store,
	StoreWithProducts,
} from '@/lib/api/types';
