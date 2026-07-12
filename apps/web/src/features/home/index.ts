/**
 * Home / marketing feature public surface.
 */
export { default as HomePage } from './components';
export { default as CategoriesGrid } from './components/CategoriesGrid';
export { default as DealsBar } from './components/DealsBar';
export { default as FeaturedMerchants } from './components/FeaturedMerchants';
export { default as FeaturedProducts } from './components/FeaturedProducts';
export { default as HeroSection } from './components/HeroSection';
export { default as HowItWorks } from './components/HowItWorks';
export { default as LiveCommerce } from './components/LiveCommerce';
export { default as MobileAppCTA } from './components/MobileAppCTA';
export { default as NoufProtect } from './components/NoufProtect';
export { default as StatsMarquee } from './components/StatsMarquee';
export { default as SubscriptionTiers } from './components/SubscriptionTiers';

export { getHomeStats, getSystemHealth } from './api/system';

export type { HomeStats, SystemHealth, SystemHealthCheck } from '@/lib/api/types';
