import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { Route, Routes } from 'react-router';
import { ErrorBoundary } from './components/ErrorBoundary';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { ProductGridSkeleton } from './components/Skeletons';
import { AppProvider } from './context/AppContext';
import { CartProvider } from '@/features/cart/context/CartContext';

/**
 * Code-split every page. Each `React.lazy` import becomes a separate
 * JS chunk that the bundler downloads on demand. The user only
 * pays the cost of pages they visit. This shrinks the initial
 * bundle dramatically — the old eager App.tsx pulled every page
 * (and every page's dependencies: framer-motion, gsap, recharts)
 * into the first paint.
 *
 * Failure boundary: if a chunk fails to load (offline, 404, hash
 * mismatch on a stale service-worker cache) the `lazyErrorFallback`
 * kicks in instead of crashing the whole tree.
 */
function lazyPage<T extends ComponentType<unknown>>(
	importer: () => Promise<{ default: T }>,
): React.LazyExoticComponent<T> {
	return lazy(() =>
		importer().catch((err) => {
			console.error('[App] failed to load page chunk, falling back:', err);
			return {
				default: (() => (
					<div className="p-8 text-center text-muted-foreground">
						Failed to load page. Try refreshing.
					</div>
				)) as unknown as T,
			};
		}),
	);
}

// Public pages — code-split so the homepage loads fast.
const Home = lazyPage(() => import('./pages/Home'));
const SearchResults = lazyPage(() => import('./pages/SearchResults'));
const ProductDetail = lazyPage(() => import('./pages/ProductDetail'));
const StorePage = lazyPage(() => import('./pages/StorePage'));
const Categories = lazyPage(() => import('./pages/Categories'));
const Deals = lazyPage(() => import('./pages/Deals'));
const Checkout = lazyPage(() => import('./pages/Checkout'));
const NotFound = lazyPage(() => import('./pages/NotFound'));

// Auth pages — only loaded when the user navigates to /auth/*.
const Login = lazyPage(() => import('./pages/auth/Login'));
const Register = lazyPage(() => import('./pages/auth/Register'));
const ForgotPassword = lazyPage(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazyPage(() => import('./pages/auth/ResetPassword'));

// Customer area — code-split behind the role guard; merchant + admin
// routes never load these chunks for an anonymous visitor.
const CustomerDashboard = lazyPage(() => import('./pages/customer/CustomerDashboard'));
const CustomerOrders = lazyPage(() => import('./pages/customer/CustomerOrders'));
const CustomerOrderDetail = lazyPage(() => import('./pages/customer/OrderDetail'));
const CustomerProfile = lazyPage(() => import('./pages/customer/Profile'));
const CustomerWallet = lazyPage(() => import('./pages/customer/Wallet'));
const CustomerCoupons = lazyPage(() => import('./pages/customer/Coupons'));
const CustomerHelp = lazyPage(() => import('./pages/customer/Help'));
const Wishlist = lazyPage(() => import('./pages/customer/Wishlist'));
const Reviews = lazyPage(() => import('./pages/customer/Reviews'));
const Addresses = lazyPage(() => import('./pages/customer/Addresses'));
const Notifications = lazyPage(() => import('./pages/customer/Notifications'));
const Messages = lazyPage(() => import('./pages/Messages'));

// Seller area — same idea, isolated from the customer bundle.
const SellerDashboard = lazyPage(() => import('./pages/seller/SellerDashboard'));
const SellerProducts = lazyPage(() => import('./pages/seller/SellerProducts'));
// G12 fix 2026-07-12: dedicated page for the "New Product" wizard.
// SellerDashboard's header button links directly to
// /seller/products/new; the page hosts the same AddProductWizard
// used in the modal on /seller/products, but full-page so the
// seller gets a focused multi-step form.
const SellerProductNew = lazyPage(() => import('./pages/seller/SellerProductNew'));
const SellerOrders = lazyPage(() => import('./pages/seller/SellerOrders'));
const SellerAnalytics = lazyPage(() => import('./pages/seller/SellerAnalytics'));
// G10 fix 2026-07-11: dedicated onboarding page for first-time
// merchants. The store-creation call needs a logged-in merchant
// before it can succeed; we route freshly-registered merchants here
// from Register.tsx, then onward to /seller.
const SellerOnboarding = lazyPage(() => import('./pages/seller/SellerOnboarding'));

// Admin — biggest bundle (recharts, full data tables); isolated so
// the 99% of visitors who never visit /admin never download it.
const AdminDashboard = lazyPage(() => import('./pages/admin/AdminDashboard'));
const UsersManagement = lazyPage(() => import('./pages/admin/UsersManagement'));
const StoresManagement = lazyPage(() => import('./pages/admin/StoresManagement'));
const DisputesManagement = lazyPage(() => import('./pages/admin/DisputesManagement'));
const ReportsAnalytics = lazyPage(() => import('./pages/admin/ReportsAnalytics'));
const AdminOverview = lazyPage(() => import('./pages/admin/AdminOverview'));
const AdminAuditLog = lazyPage(() => import('./pages/admin/AdminAuditLog'));
const AdminProducts = lazyPage(() => import('./pages/admin/AdminProducts'));
const AdminOrders = lazyPage(() => import('./pages/admin/AdminOrders'));
const AdminSettings = lazyPage(() => import('./pages/admin/AdminSettings'));
const AdminCategories = lazyPage(() => import('./pages/admin/AdminCategories'));
const AdminCoupons = lazyPage(() => import('./pages/admin/AdminCoupons'));
const AdminReviews = lazyPage(() => import('./pages/admin/AdminReviews'));
const AdminNotificationsPage = lazyPage(
	() => import('./pages/admin/AdminNotifications'),
);
const AdminSystemHealth = lazyPage(() => import('./pages/admin/AdminSystemHealth'));

/** Wrap a page in ProtectedRoute + Suspense so the loader shows during
 *  the chunk download AND the auth check. */
function guard(
	roles: ('customer' | 'merchant' | 'admin')[],
	Page: React.LazyExoticComponent<ComponentType<unknown>>,
): ReactNode {
	return (
		<ProtectedRoute allowedRoles={roles}>
			<Suspense fallback={<ProductGridSkeleton count={6} />}>
				<Page />
			</Suspense>
		</ProtectedRoute>
	);
}

export default function App() {
	return (
		<AppProvider>
			<CartProvider>
				<Layout>
					<ErrorBoundary>
						<Suspense fallback={<ProductGridSkeleton count={6} />}>
							<Routes>
								<Route path="/" element={<Home />} />
								<Route path="/search" element={<SearchResults />} />
								<Route path="/product/:id" element={<ProductDetail />} />
								<Route path="/store/:id" element={<StorePage />} />
								<Route path="/categories" element={<Categories />} />
								<Route path="/deals" element={<Deals />} />
								<Route
									path="/checkout"
									element={guard(['customer', 'merchant', 'admin'], Checkout)}
								/>
								<Route
									path="/seller"
									element={guard(['merchant', 'admin'], SellerDashboard)}
								/>
								<Route
									path="/seller/products"
									element={guard(['merchant', 'admin'], SellerProducts)}
								/>
								<Route
									path="/seller/products/new"
									element={guard(['merchant', 'admin'], SellerProductNew)}
								/>
								<Route
									path="/seller/orders"
									element={guard(['merchant', 'admin'], SellerOrders)}
								/>
								<Route
									path="/seller/analytics"
									element={guard(['merchant', 'admin'], SellerAnalytics)}
								/>
								{/* G10 fix 2026-07-11: onboarding wizard — the
									    first-time-merchant flow ends here. */}
								<Route
									path="/seller/onboarding"
									element={guard(['merchant', 'admin'], SellerOnboarding)}
								/>
								<Route
									path="/customer"
									element={guard(
										['customer', 'merchant', 'admin'],
										CustomerDashboard,
									)}
								/>
								<Route
									path="/customer/orders"
									element={guard(
										['customer', 'merchant', 'admin'],
										CustomerOrders,
									)}
								/>
								<Route
									path="/customer/orders/:id"
									element={guard(
										['customer', 'merchant', 'admin'],
										CustomerOrderDetail,
									)}
								/>
								<Route
									path="/customer/profile"
									element={guard(
										['customer', 'merchant', 'admin'],
										CustomerProfile,
									)}
								/>
								<Route
									path="/customer/wallet"
									element={guard(
										['customer', 'merchant', 'admin'],
										CustomerWallet,
									)}
								/>
								<Route
									path="/customer/coupons"
									element={guard(
										['customer', 'merchant', 'admin'],
										CustomerCoupons,
									)}
								/>
								<Route
									path="/customer/help"
									element={guard(
										['customer', 'merchant', 'admin'],
										CustomerHelp,
									)}
								/>
								<Route
									path="/customer/wishlist"
									element={guard(['customer', 'merchant', 'admin'], Wishlist)}
								/>
								<Route
									path="/customer/reviews"
									element={guard(['customer', 'merchant', 'admin'], Reviews)}
								/>
								<Route
									path="/customer/addresses"
									element={guard(['customer', 'merchant', 'admin'], Addresses)}
								/>
								<Route
									path="/customer/notifications"
									element={guard(
										['customer', 'merchant', 'admin'],
										Notifications,
									)}
								/>
								{/* Admin area — AdminDashboard is now a sidebar shell
								 *  with <Outlet />; nested routes render inside it.
								 *  `/admin` (no sub-path) redirects to `/admin/overview`. */}
								<Route path="/admin" element={guard(['admin'], AdminDashboard)}>
									<Route index element={
											<Suspense fallback={<ProductGridSkeleton count={6} />}>
												<AdminOverview />
											</Suspense>
										} />
									<Route
										path="overview"
										element={
											<Suspense fallback={<ProductGridSkeleton count={6} />}>
												<AdminOverview />
											</Suspense>
										}
									/>
									<Route
										path="users"
										element={
											<Suspense fallback={<ProductGridSkeleton count={6} />}>
												<UsersManagement />
											</Suspense>
										}
									/>
									<Route
										path="stores"
										element={
											<Suspense fallback={<ProductGridSkeleton count={6} />}>
												<StoresManagement />
											</Suspense>
										}
									/>
									<Route
										path="disputes"
										element={
											<Suspense fallback={<ProductGridSkeleton count={6} />}>
												<DisputesManagement />
											</Suspense>
										}
									/>
									<Route
										path="reports"
										element={
											<Suspense fallback={<ProductGridSkeleton count={6} />}>
												<ReportsAnalytics />
											</Suspense>
										}
									/>
									<Route
										path="audit-log"
										element={
											<Suspense fallback={<ProductGridSkeleton count={6} />}>
												<AdminAuditLog />
											</Suspense>
										}
									/>
									<Route
										path="all-products"
										element={
											<Suspense fallback={<ProductGridSkeleton count={6} />}>
												<AdminProducts />
											</Suspense>
										}
									/>
									<Route
										path="all-orders"
										element={
											<Suspense fallback={<ProductGridSkeleton count={6} />}>
												<AdminOrders />
											</Suspense>
										}
									/>
									<Route
										path="categories"
										element={
											<Suspense fallback={<ProductGridSkeleton count={6} />}>
												<AdminCategories />
											</Suspense>
										}
									/>
									<Route
										path="reviews"
										element={
											<Suspense fallback={<ProductGridSkeleton count={6} />}>
												<AdminReviews />
											</Suspense>
										}
									/>
									<Route
										path="coupons"
										element={
											<Suspense fallback={<ProductGridSkeleton count={6} />}>
												<AdminCoupons />
											</Suspense>
										}
									/>
									<Route
										path="notifications"
										element={
											<Suspense fallback={<ProductGridSkeleton count={6} />}>
												<AdminNotificationsPage />
											</Suspense>
										}
									/>
									<Route
										path="settings"
										element={
											<Suspense fallback={<ProductGridSkeleton count={6} />}>
												<AdminSettings />
											</Suspense>
										}
									/>
									<Route
										path="system"
										element={
											<Suspense fallback={<ProductGridSkeleton count={6} />}>
												<AdminSystemHealth />
											</Suspense>
										}
									/>
								</Route>
								<Route
									path="/messages"
									element={guard(
										['customer', 'merchant', 'admin'],
										Messages,
									)}
								/>
								<Route path="/auth/login" element={<Login />} />
								<Route path="/auth/register" element={<Register />} />
								<Route path="/auth/forgot-password" element={<ForgotPassword />} />
								<Route path="/auth/reset-password" element={<ResetPassword />} />
								<Route path="*" element={<NotFound />} />
							</Routes>
						</Suspense>
					</ErrorBoundary>
				</Layout>
			</CartProvider>
		</AppProvider>
	);
}
