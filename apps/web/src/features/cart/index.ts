/**
 * Cart, wishlist, store followers feature public surface.
 */
export { CartProvider, useCart } from './context/CartContext';

export {
	addToCart,
	addToWishlist,
	checkStoreFollowStatus,
	clearCart,
	getCart,
	getCartCount,
	getWishlist,
	removeFromCart,
	removeFromWishlist,
	updateCartItem,
} from './api/cart';

export type { CartItem, WishlistItem } from '@/lib/api/types';
