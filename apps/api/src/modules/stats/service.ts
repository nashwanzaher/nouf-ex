import { cacheWrapCluster } from '../../lib/cache.ts';
import { getProductWithParsedFields } from '../../lib/shared.ts';
import * as repo from './repository.ts';

const HOME_STATS_TTL_S = 30;
const HOME_STATS_KEY = 'stats:home:v1';

export async function getHomeStats() {
	return cacheWrapCluster(HOME_STATS_KEY, HOME_STATS_TTL_S, async () => {
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
	});
}