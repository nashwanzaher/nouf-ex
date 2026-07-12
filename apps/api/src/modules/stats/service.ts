import { getProductWithParsedFields } from '../../lib/shared.ts';
import * as repo from './repository.ts';

export async function getHomeStats() {
	const [products, stores, orders, users, featured, deals] = await Promise.all([
		repo.countProducts(),
		repo.countStores(),
		repo.countOrders(),
		repo.countUsers(),
		repo.featuredProducts(),
		repo.dealProducts(),
	]);
	return {
		counts: { products, stores, orders, users },
		featured: featured.map(getProductWithParsedFields),
		deals: deals.map(getProductWithParsedFields),
	};
}