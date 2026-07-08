import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCart } from '../context/CartContext';
import { Home, Grid3X3, MessageSquare, ShoppingCart, User } from 'lucide-react';

export default function BottomNav() {
	const { t } = useTranslation();
	const location = useLocation();
	const { cartCount } = useCart();
	const path = location.pathname;

	const isActive = (p: string) => path === p;

	const items = [
		{ to: '/', icon: Home, label: t('nav.home'), ariaLabel: t('nav.home') },
		{ to: '/categories', icon: Grid3X3, label: t('nav.categories'), ariaLabel: t('nav.categories') },
		{ to: '/messages', icon: MessageSquare, label: t('nav.messages'), ariaLabel: t('nav.messages') },
		{ to: '/checkout', icon: ShoppingCart, label: t('nav.cart'), ariaLabel: t('nav.cart') },
		{ to: '/auth/login', icon: User, label: t('nav.account'), ariaLabel: t('nav.account') },
	];

	return (
		<nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-aliBorder shadow-[0_-4px_20px_rgba(0,0,0,0.06)] lg:hidden">
			<div className="flex items-center justify-around h-16 max-w-[600px] mx-auto">
				{items.map((item) => (
					<Link
						key={item.to}
						to={item.to}
						aria-label={item.ariaLabel}
						className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-colors ${
							isActive(item.to)
								? 'text-aliOrange'
								: 'text-aliTextMute hover:text-aliText'
						}`}
					>
						<div className="relative">
							<item.icon size={22} strokeWidth={isActive(item.to) ? 2.5 : 1.5} />
							{item.to === '/checkout' && cartCount > 0 && (
								<span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] bg-aliOrange text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
									{cartCount > 99 ? '99+' : cartCount}
								</span>
							)}
						</div>
						<span className="text-[10px] font-medium leading-none">{item.label}</span>
					</Link>
				))}
			</div>
		</nav>
	);
}
