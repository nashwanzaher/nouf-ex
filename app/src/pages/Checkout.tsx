/**
 * Nouf-ex — Checkout page
 *
 * Final step of the cart-to-order pipeline (P0-1).
 *   - Reads items from CartContext (localStorage-backed).
 *   - Resolves the active customer via useAuth() so anonymous
 *     visitors get redirected to /auth/login.
 *   - Fetches the user's saved addresses from /api/addresses and
 *     lets them pick one (or open the "new address" dialog).
 *   - Fetches shipping options from /api/shipping/methods for the
 *     current cart weight and shows the cheapest.
 *   - Validates a coupon code through /api/coupons/validate and
 *     applies the discount.
 *   - Places the order via /api/orders (server-side discount is
 *     authoritative, see P0-5) and clears the cart.
 */

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
	ShoppingBag,
	MapPin,
	Tag,
	CreditCard,
	CheckCircle2,
	Loader2,
	Plus,
	AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCart } from '@/context/CartContext';
import { useAuth, useApp } from '@/context/AppContext';
import {
	useUserAddresses,
	useShippingMethods,
	usePlaceOrder,
	useCouponValidation,
} from '@/hooks/useApi';
import { createAddress, clearCart } from '@/lib/api';
import type { Address, CouponValidation, ShippingMethod } from '@/hooks/useApi';

const COUNTRY_DEFAULT = 'YE';

export default function Checkout() {
	const { t, i18n } = useTranslation();
	const navigate = useNavigate();
	const isRTL = i18n.language === 'ar';
	const { state: cartState, dispatch, cartTotal } = useCart();
	const { user, isAuthenticated } = useAuth();
	const { addToast: addAppToast } = useApp();

	// Gate: only signed-in customers can place orders. Guests see a
	// "please sign in" panel. The state is already derived from
	// useAuth() -- no effect needed, the inline CTA below handles it.

	// ── Form state ───────────────────────────────────────────
	const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
	const [paymentMethod, setPaymentMethod] = useState<'cod' | 'card' | 'wallet'>('cod');
	const [notes, setNotes] = useState('');
	const [couponCode, setCouponCode] = useState('');
	const [couponApplied, setCouponApplied] = useState<CouponValidation | null>(null);
	const [newAddressOpen, setNewAddressOpen] = useState(false);
	const [newAddress, setNewAddress] = useState<Partial<Address>>({});

	// ── Data ─────────────────────────────────────────────────
	const { data: addressesResp, refetch: refetchAddresses } = useUserAddresses(
		user ? Number(user.id) : null,
	);
	const { data: shippingResp } = useShippingMethods(estimateWeight(cartState.items));
	const { submitting, error, placeOrder } = usePlaceOrder();
	// `result` is unused: we read the validated coupon straight from
	// `validateCoupon()`'s return value in `handleApplyCoupon`. We
	// still destructure it so the hook can clear the previous error
	// on a fresh attempt.
	const { validating, error: couponError, validate: validateCoupon } = useCouponValidation();

	const addresses = useMemo<Address[]>(() => addressesResp ?? [], [addressesResp]);
	const shippingMethods = useMemo<ShippingMethod[]>(
		() => (shippingResp ?? []) as unknown as ShippingMethod[],
		[shippingResp],
	);

	// Default-select the user's first address when the list loads.
	// We use a `useState` lazy initializer so the default is captured
	// the first time the addresses array transitions from empty to
	// non-empty -- no useEffect, no cascading render.
	const [autoSelected, setAutoSelected] = useState(false);
	const defaultAddressId = useMemo(() => {
		if (addresses.length === 0) return null;
		const def = addresses.find((a) => Number(a.is_default ?? 0) === 1) ?? addresses[0];
		return def.id;
	}, [addresses]);
	if (defaultAddressId != null && !autoSelected && selectedAddressId == null) {
		setAutoSelected(true);
		setSelectedAddressId(defaultAddressId);
	}

	// ── Derived ──────────────────────────────────────────────
	const shipping = useMemo(() => {
		if (shippingMethods.length === 0) return 0;
		// shippingMethods[0] is the cheapest (ORDER BY base_cost ASC).
		const first = shippingMethods[0] as unknown as {
			estimated_total?: number | string;
			base_cost?: number | string;
		};
		return Math.max(0, Number(first.estimated_total ?? first.base_cost) || 0);
	}, [shippingMethods]);

	const subtotal = cartTotal;
	const discount = couponApplied?.discount ?? 0;
	const total = Math.max(0, subtotal - discount + shipping);

	// ── Handlers ─────────────────────────────────────────────
	const handleApplyCoupon = async () => {
		if (!couponCode.trim() || !user) return;
		const result = await validateCoupon(couponCode.trim(), subtotal, Number(user.id));
		if (result) setCouponApplied(result);
		// On error, the `couponError` from the hook is shown next to the
		// input automatically.
	};

	const handleRemoveCoupon = () => {
		setCouponApplied(null);
		setCouponCode('');
	};

	const handleNewAddress = async () => {
		if (
			!newAddress.label ||
			!newAddress.full_name ||
			!newAddress.phone ||
			!newAddress.governorate ||
			!newAddress.city ||
			!newAddress.street
		) {
			addAppToast({
				message: t('checkout.fillRequired', 'Please fill the required fields'),
				type: 'warning',
			});
			return;
		}
		try {
			const created = await createAddress({
				label: String(newAddress.label),
				full_name: String(newAddress.full_name),
				phone: String(newAddress.phone),
				governorate: String(newAddress.governorate),
				city: String(newAddress.city),
				district: newAddress.district ? String(newAddress.district) : undefined,
				street: String(newAddress.street),
				building: newAddress.building ? String(newAddress.building) : undefined,
				notes: newAddress.notes ? String(newAddress.notes) : undefined,
				is_default: Boolean(newAddress.is_default),
			});
			setSelectedAddressId(created.id);
			setNewAddressOpen(false);
			setNewAddress({});
			refetchAddresses();
			addAppToast({
				message: t('checkout.addressSaved', 'Address saved'),
				type: 'success',
			});
		} catch (err) {
			addAppToast({
				message:
					err instanceof Error
						? err.message
						: t('checkout.addressSaveFailed', 'Failed to save address'),
				type: 'error',
			});
		}
	};

	const handlePlaceOrder = async () => {
		if (!user) return;
		if (cartState.items.length === 0) {
			addAppToast({
				message: t('checkout.emptyCart', 'Your cart is empty'),
				type: 'warning',
			});
			return;
		}
		if (selectedAddressId == null) {
			addAppToast({
				message: t('checkout.pickAddress', 'Pick a shipping address'),
				type: 'warning',
			});
			return;
		}
		const address = addresses.find((a) => a.id === selectedAddressId);
		if (!address) return;

		// Build the order payload. The server is the source of truth
		// for the storeId (P0-1): it derives it from the items'
		// products and rejects mixed-store carts. The server also
		// recomputes discount + total (P0-5), so the values we send
		// are hints only.
		const orderBody = {
			// storeId intentionally omitted — the server derives it.
			items: cartState.items.map((i) => ({
				productId: Number(i.productId),
				quantity: i.quantity,
				unitPrice: i.price,
			})),
			shippingAddress: {
				label: address.label,
				full_name: address.full_name,
				phone: address.phone,
				governorate: address.governorate,
				city: address.city,
				district: address.district ?? undefined,
				street: address.street,
				building: address.building ?? undefined,
				notes: address.notes ?? undefined,
			},
			paymentMethod:
				paymentMethod === 'wallet' ? 'wallet' : paymentMethod === 'card' ? 'card' : 'cod',
			notes: notes || undefined,
			subtotal,
			shippingCost: shipping,
			discount,
			total,
			couponCode: couponApplied?.code,
		};

		const result = await placeOrder(orderBody as Parameters<typeof placeOrder>[0]);
		if (result) {
			// Clear the local cart (UI) and the server cart (DB) in
			// parallel. Either failing is non-fatal — the user has
			// already paid and the worst case is a stale row on the
			// server that the next syncOnLogin will overwrite.
			dispatch({ type: 'CLEAR' });
			void clearCart(Number(user.id)).catch((err) => {
				// Best-effort. Log so we can spot persistent failures.
				console.warn('[Checkout] server cart clear failed', err);
			});
			addAppToast({
				message: t('checkout.orderPlaced', 'Order {number} placed', {
					number: result.orderNumber,
				}),
				type: 'success',
			});
			navigate(`/customer/orders?just=${result.id}`, { replace: true });
		}
	};

	// ── Render ──────────────────────────────────────────────
	if (!isAuthenticated) {
		return (
			<div
				className="min-h-[100dvh] flex items-center justify-center px-4"
				dir={isRTL ? 'rtl' : 'ltr'}
			>
				<div className="max-w-md w-full bg-white border border-aliBorder rounded-2xl p-8 text-center">
					<ShoppingBag className="w-12 h-12 mx-auto text-aliOrange" strokeWidth={1.5} />
					<h1 className="mt-4 text-xl font-bold text-aliText">
						{t('checkout.guestTitle', 'Sign in to checkout')}
					</h1>
					<p className="mt-2 text-sm text-aliTextMute">
						{t('checkout.guestBody', 'You have {count} item(s) in your cart.', {
							count: cartState.items.length,
						})}
					</p>
					<div className="mt-6 flex flex-col gap-2">
						<Button asChild>
							<Link to="/auth/login?next=/checkout">
								{t('checkout.signIn', 'Sign in')}
							</Link>
						</Button>
						<Button variant="outline" asChild>
							<Link to="/auth/register">
								{t('checkout.createAccount', 'Create account')}
							</Link>
						</Button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-[100dvh] bg-aliSurface py-8 px-4" dir={isRTL ? 'rtl' : 'ltr'}>
			<div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
				{/* ─── Left column: address + payment ─── */}
				<div className="space-y-6">
					{/* Shipping address */}
					<section className="bg-white border border-aliBorder rounded-2xl p-5">
						<header className="flex items-center justify-between mb-4">
							<h2 className="font-bold text-aliText flex items-center gap-2">
								<MapPin className="w-4 h-4 text-aliOrange" />
								{t('checkout.addressTitle', 'Shipping address')}
							</h2>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setNewAddressOpen((v) => !v)}
							>
								<Plus className="w-4 h-4 me-1" />
								{t('checkout.newAddress', 'New address')}
							</Button>
						</header>
						{newAddressOpen && (
							<div className="mb-4 border border-aliBorder rounded-lg p-4 bg-aliSurface/40 space-y-3">
								<div className="grid grid-cols-2 gap-3">
									<div>
										<Label>{t('checkout.label', 'Label')}</Label>
										<Input
											value={newAddress.label ?? ''}
											onChange={(e) =>
												setNewAddress((a) => ({
													...a,
													label: e.target.value,
												}))
											}
											placeholder={t(
												'checkout.labelPlaceholder',
												'Home / Work',
											)}
										/>
									</div>
									<div>
										<Label>{t('checkout.fullName', 'Full name')}</Label>
										<Input
											value={newAddress.full_name ?? ''}
											onChange={(e) =>
												setNewAddress((a) => ({
													...a,
													full_name: e.target.value,
												}))
											}
										/>
									</div>
									<div>
										<Label>{t('checkout.phone', 'Phone')}</Label>
										<Input
											value={newAddress.phone ?? ''}
											onChange={(e) =>
												setNewAddress((a) => ({
													...a,
													phone: e.target.value,
												}))
											}
											placeholder={t('checkout.phonePlaceholder', '+9677...')}
										/>
									</div>
									<div>
										<Label>{t('checkout.governorate', 'Governorate')}</Label>
										<Input
											value={newAddress.governorate ?? ''}
											onChange={(e) =>
												setNewAddress((a) => ({
													...a,
													governorate: e.target.value,
												}))
											}
										/>
									</div>
									<div>
										<Label>{t('checkout.city', 'City')}</Label>
										<Input
											value={newAddress.city ?? ''}
											onChange={(e) =>
												setNewAddress((a) => ({
													...a,
													city: e.target.value,
												}))
											}
										/>
									</div>
									<div>
										<Label>{t('checkout.district', 'District')}</Label>
										<Input
											value={newAddress.district ?? ''}
											onChange={(e) =>
												setNewAddress((a) => ({
													...a,
													district: e.target.value,
												}))
											}
										/>
									</div>
									<div className="col-span-2">
										<Label>{t('checkout.street', 'Street')}</Label>
										<Input
											value={newAddress.street ?? ''}
											onChange={(e) =>
												setNewAddress((a) => ({
													...a,
													street: e.target.value,
												}))
											}
										/>
									</div>
									<div className="col-span-2">
										<Label>{t('checkout.notes', 'Notes')}</Label>
										<Textarea
											value={newAddress.notes ?? ''}
											onChange={(e) =>
												setNewAddress((a) => ({
													...a,
													notes: e.target.value,
												}))
											}
										/>
									</div>
									<label className="col-span-2 flex items-center gap-2 text-sm">
										<input
											type="checkbox"
											checked={Boolean(newAddress.is_default)}
											onChange={(e) =>
												setNewAddress((a) => ({
													...a,
													is_default: e.target.checked,
												}))
											}
										/>
										{t('checkout.isDefault', 'Make it the default')}
									</label>
								</div>
								<div className="flex justify-end gap-2">
									<Button
										variant="ghost"
										onClick={() => setNewAddressOpen(false)}
									>
										{t('checkout.cancel', 'Cancel')}
									</Button>
									<Button onClick={handleNewAddress}>
										{t('checkout.save', 'Save')}
									</Button>
								</div>
							</div>
						)}
						{addresses.length === 0 ? (
							<p className="text-sm text-aliTextMute">
								{t('checkout.noAddresses', 'No saved addresses yet.')}
							</p>
						) : (
							<div className="space-y-2">
								{addresses.map((a) => (
									<label
										key={a.id}
										className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
											selectedAddressId === a.id
												? 'border-aliOrange bg-aliOrange/5'
												: 'border-aliBorder hover:bg-aliSurface/40'
										}`}
									>
										<input
											type="radio"
											name="address"
											value={a.id}
											checked={selectedAddressId === a.id}
											onChange={() => setSelectedAddressId(a.id)}
											className="mt-1"
										/>
										<div className="text-sm flex-1">
											<div className="font-semibold text-aliText flex items-center gap-2">
												{a.label}
												{Number(a.is_default ?? 0) === 1 && (
													<span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-aliOrange/15 text-aliOrange">
														{t('checkout.defaultBadge', 'Default')}
													</span>
												)}
											</div>
											<div className="text-aliTextMute">
												{a.full_name} · {a.phone}
											</div>
											<div className="text-aliTextMute text-xs">
												{a.street}, {a.city}, {a.governorate}
											</div>
										</div>
									</label>
								))}
							</div>
						)}
					</section>

					{/* Payment method */}
					<section className="bg-white border border-aliBorder rounded-2xl p-5">
						<h2 className="font-bold text-aliText flex items-center gap-2 mb-4">
							<CreditCard className="w-4 h-4 text-aliOrange" />
							{t('checkout.paymentTitle', 'Payment method')}
						</h2>
						<div className="grid grid-cols-3 gap-2">
							{(['cod', 'card', 'wallet'] as const).map((m) => (
								<label
									key={m}
									className={`flex flex-col items-center gap-1 p-3 border rounded-lg cursor-pointer text-xs ${
										paymentMethod === m
											? 'border-aliOrange bg-aliOrange/5 text-aliText font-bold'
											: 'border-aliBorder text-aliTextMute hover:bg-aliSurface/40'
									}`}
								>
									<input
										type="radio"
										name="pay"
										value={m}
										checked={paymentMethod === m}
										onChange={() => setPaymentMethod(m)}
										className="sr-only"
									/>
									{m === 'cod'
										? t('checkout.paymentCod', 'Cash on delivery')
										: m === 'card'
											? t('checkout.paymentCard', 'Card')
											: t('checkout.paymentWallet', 'Wallet')}
								</label>
							))}
						</div>
					</section>

					{/* Notes */}
					<section className="bg-white border border-aliBorder rounded-2xl p-5">
						<h2 className="font-bold text-aliText mb-2">
							{t('checkout.notesTitle', 'Order notes')}
						</h2>
						<Textarea
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							placeholder={t(
								'checkout.notesPlaceholder',
								'Delivery instructions, special requests, etc.',
							)}
						/>
					</section>
				</div>

				{/* ─── Right column: order summary ─── */}
				<aside className="lg:sticky lg:top-20 lg:self-start space-y-4">
					<section className="bg-white border border-aliBorder rounded-2xl p-5">
						<h2 className="font-bold text-aliText flex items-center gap-2 mb-4">
							<ShoppingBag className="w-4 h-4 text-aliOrange" />
							{t('checkout.summaryTitle', 'Order summary')}
						</h2>
						{cartState.items.length === 0 ? (
							<p className="text-sm text-aliTextMute">
								{t('checkout.summaryEmpty', 'Your cart is empty.')}{' '}
								<Link to="/" className="text-aliOrange hover:underline">
									{t('checkout.summaryShopNow', 'Shop now')}
								</Link>
							</p>
						) : (
							<ul className="divide-y divide-aliBorder">
								{cartState.items.map((i) => (
									<li
										key={i.productId}
										className="py-3 flex items-center gap-3 text-sm"
									>
										{i.image ? (
											<img
												src={i.image}
												alt={i.name}
												className="w-12 h-12 object-cover rounded border border-aliBorder"
											/>
										) : (
											<div className="w-12 h-12 bg-aliSurface rounded border border-aliBorder" />
										)}
										<div className="flex-1 min-w-0">
											<div className="font-semibold text-aliText truncate">
												{i.name}
											</div>
											<div className="text-aliTextMute text-xs">
												{i.quantity} × {i.price.toLocaleString()}{' '}
												{COUNTRY_DEFAULT === 'YE' ? 'YER' : ''}
											</div>
										</div>
										<button
											type="button"
											className="text-xs text-aliOrange hover:underline"
											onClick={() =>
												dispatch({ type: 'REMOVE', payload: i.productId })
											}
										>
											{t('checkout.summaryRemove', 'Remove')}
										</button>
									</li>
								))}
							</ul>
						)}
					</section>

					{/* Coupon */}
					{cartState.items.length > 0 && (
						<section className="bg-white border border-aliBorder rounded-2xl p-5">
							<h2 className="font-bold text-aliText flex items-center gap-2 mb-3">
								<Tag className="w-4 h-4 text-aliOrange" />
								{t('checkout.couponTitle', 'Coupon')}
							</h2>
							{couponApplied ? (
								<div className="flex items-center justify-between p-3 rounded bg-aliOrange/10 text-sm">
									<span className="font-mono font-bold text-aliOrange">
										{couponApplied.code}
									</span>
									<div className="flex items-center gap-2">
										<span className="text-aliText">
											− {couponApplied.discount.toLocaleString()}
										</span>
										<button
											type="button"
											className="text-xs text-aliTextMute hover:text-aliOrange"
											onClick={handleRemoveCoupon}
										>
											{t('checkout.couponRemove', 'Remove')}
										</button>
									</div>
								</div>
							) : (
								<div className="flex gap-2">
									<Input
										placeholder={t('checkout.couponPlaceholder', 'Coupon code')}
										value={couponCode}
										onChange={(e) =>
											setCouponCode(e.target.value.toUpperCase())
										}
									/>
									<Button
										type="button"
										disabled={!couponCode.trim() || validating}
										onClick={handleApplyCoupon}
									>
										{validating ? (
											<Loader2 className="w-4 h-4 animate-spin" />
										) : (
											t('checkout.couponApply', 'Apply')
										)}
									</Button>
								</div>
							)}
							{couponError && (
								<p className="mt-2 text-xs text-red-500 flex items-center gap-1">
									<AlertCircle className="w-3 h-3" /> {couponError}
								</p>
							)}
						</section>
					)}

					{/* Totals */}
					<section className="bg-white border border-aliBorder rounded-2xl p-5 space-y-2 text-sm">
						<div className="flex justify-between">
							<span className="text-aliTextMute">
								{t('checkout.subtotal', 'Subtotal')}
							</span>
							<span className="font-semibold text-aliText">
								{subtotal.toLocaleString()} YER
							</span>
						</div>
						<div className="flex justify-between">
							<span className="text-aliTextMute">
								{t('checkout.shipping', 'Shipping')}
							</span>
							<span className="font-semibold text-aliText">
								{shipping.toLocaleString()} YER
							</span>
						</div>
						{discount > 0 && (
							<div className="flex justify-between text-aliOrange">
								<span>{t('checkout.discount', 'Discount')}</span>
								<span className="font-semibold">
									− {discount.toLocaleString()} YER
								</span>
							</div>
						)}
						<div className="flex justify-between pt-2 border-t border-aliBorder text-base">
							<span className="font-bold text-aliText">
								{t('checkout.total', 'Total')}
							</span>
							<span className="font-bold text-aliOrange">
								{total.toLocaleString()} YER
							</span>
						</div>
						{error && (
							<p className="mt-2 text-xs text-red-500 flex items-center gap-1">
								<AlertCircle className="w-3 h-3" /> {error}
							</p>
						)}
						<Button
							type="button"
							className="w-full mt-3"
							disabled={
								submitting ||
								cartState.items.length === 0 ||
								selectedAddressId == null
							}
							onClick={handlePlaceOrder}
						>
							{submitting ? (
								<Loader2 className="w-4 h-4 animate-spin me-2" />
							) : (
								<CheckCircle2 className="w-4 h-4 me-2" />
							)}
							{submitting
								? t('checkout.placingOrder', 'Placing order...')
								: t('checkout.placeOrder', 'Place order')}
						</Button>
					</section>
				</aside>
			</div>
		</div>
	);
}

/** Rough weight estimate (kg) per item for the shipping calc.
 *  Real product weight lives in `products.weight`; for cart items we
 *  don't have it, so we use a sensible default. */
function estimateWeight(items: { quantity: number }[]): number {
	const total = items.reduce((s, i) => s + i.quantity, 0);
	return Math.max(0.5, total * 0.5);
}
