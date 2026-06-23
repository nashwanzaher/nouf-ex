import { Route, Routes } from 'react-router';
import { ErrorBoundary } from './components/ErrorBoundary';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { AppProvider } from './context/AppContext';
import { CartProvider } from './context/CartContext';
import AdminDashboard from './pages/admin/AdminDashboard';
import ForgotPassword from './pages/auth/ForgotPassword';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ResetPassword from './pages/auth/ResetPassword';
import Categories from './pages/Categories';
import Addresses from './pages/customer/Addresses';
import CustomerDashboard from './pages/customer/CustomerDashboard';
import CustomerOrders from './pages/customer/CustomerOrders';
import Notifications from './pages/customer/Notifications';
import Reviews from './pages/customer/Reviews';
import Wishlist from './pages/customer/Wishlist';
import Deals from './pages/Deals';
import Home from './pages/Home';
import Checkout from './pages/Checkout';
import NotFound from './pages/NotFound';
import ProductDetail from './pages/ProductDetail';
import SearchResults from './pages/SearchResults';
import SellerAnalytics from './pages/seller/SellerAnalytics';
import SellerDashboard from './pages/seller/SellerDashboard';
import SellerOrders from './pages/seller/SellerOrders';
import SellerProducts from './pages/seller/SellerProducts';
import StorePage from './pages/StorePage';

export default function App() {
	return (
		<AppProvider>
			<CartProvider>
				<Layout>
					<ErrorBoundary>
						<Routes>
							<Route path="/" element={<Home />} />
							<Route path="/search" element={<SearchResults />} />
							<Route path="/product/:id" element={<ProductDetail />} />
							<Route path="/store/:id" element={<StorePage />} />
							<Route path="/categories" element={<Categories />} />
							<Route path="/deals" element={<Deals />} />
							<Route
								path="/checkout"
								element={
									<ProtectedRoute allowedRoles={['customer', 'merchant', 'admin']}>
										<Checkout />
									</ProtectedRoute>
								}
							/>
							<Route
								path="/seller"
								element={
									<ProtectedRoute allowedRoles={['merchant', 'admin']}>
										<SellerDashboard />
									</ProtectedRoute>
								}
							/>
							<Route
								path="/seller/products"
								element={
									<ProtectedRoute allowedRoles={['merchant', 'admin']}>
										<SellerProducts />
									</ProtectedRoute>
								}
							/>
							<Route
								path="/seller/orders"
								element={
									<ProtectedRoute allowedRoles={['merchant', 'admin']}>
										<SellerOrders />
									</ProtectedRoute>
								}
							/>
							<Route
								path="/seller/analytics"
								element={
									<ProtectedRoute allowedRoles={['merchant', 'admin']}>
										<SellerAnalytics />
									</ProtectedRoute>
								}
							/>
							<Route
								path="/customer"
								element={
									<ProtectedRoute allowedRoles={['customer', 'merchant', 'admin']}>
										<CustomerDashboard />
									</ProtectedRoute>
								}
							/>
							<Route
								path="/customer/orders"
								element={
									<ProtectedRoute allowedRoles={['customer', 'merchant', 'admin']}>
										<CustomerOrders />
									</ProtectedRoute>
								}
							/>
							<Route
								path="/customer/wishlist"
								element={
									<ProtectedRoute allowedRoles={['customer', 'merchant', 'admin']}>
										<Wishlist />
									</ProtectedRoute>
								}
							/>
							<Route
								path="/customer/reviews"
								element={
									<ProtectedRoute allowedRoles={['customer', 'merchant', 'admin']}>
										<Reviews />
									</ProtectedRoute>
								}
							/>
							<Route
								path="/customer/addresses"
								element={
									<ProtectedRoute allowedRoles={['customer', 'merchant', 'admin']}>
										<Addresses />
									</ProtectedRoute>
								}
							/>
							<Route
								path="/customer/notifications"
								element={
									<ProtectedRoute allowedRoles={['customer', 'merchant', 'admin']}>
										<Notifications />
									</ProtectedRoute>
								}
							/>
							<Route
								path="/admin"
								element={
									<ProtectedRoute allowedRoles={['admin']}>
										<AdminDashboard />
									</ProtectedRoute>
								}
							/>
							<Route path="/auth/login" element={<Login />} />
							<Route path="/auth/register" element={<Register />} />
							<Route path="/auth/forgot-password" element={<ForgotPassword />} />
							<Route path="/auth/reset-password" element={<ResetPassword />} />
							<Route path="*" element={<NotFound />} />
						</Routes>
					</ErrorBoundary>
				</Layout>
			</CartProvider>
		</AppProvider>
	);
}
