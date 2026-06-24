import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import Navbar from './Navbar';
import Footer from './Footer';
import BottomNav from './BottomNav';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
	const { i18n } = useTranslation();
	// Use react-router's location so the dashboard detection works under
	// both BrowserRouter and MemoryRouter (and stays in sync with client-side
	// navigation — the global `location.pathname` is only the browser URL).
	const { pathname } = useLocation();
	const isDashboard =
		pathname.startsWith('/seller') ||
		pathname.startsWith('/customer') ||
		pathname.startsWith('/admin');

	return (
		<div className="min-h-screen flex flex-col bg-aliSurface text-aliText">
			<a
				href="#main-content"
				className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-aliOrange focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:font-bold"
			>
				Skip to content
			</a>
			<Navbar />
			<main
				id="main-content"
				className="flex-1 pb-20 lg:pb-0"
				dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}
			>
				{children}
			</main>
			{!isDashboard && <Footer />}
			<BottomNav />
		</div>
	);
}
