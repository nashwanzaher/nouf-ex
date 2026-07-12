/**
 * Orders feature public surface.
 */
export { default as CustomerOrders } from './components/CustomerOrders';

export { createOrder, getOrder, getOrders, type CreateOrderBody } from './api/orders';

export type { Order, OrderWithItems } from '@/lib/api/types';
