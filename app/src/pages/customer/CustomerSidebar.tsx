import { Link, useLocation } from 'react-router';
import {
  ShoppingBag,
  Heart,
  Star,
  MapPin,
  Bell,
  User,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { icon: ShoppingBag, label: 'طلباتي', path: '/customer/orders' },
  { icon: Heart, label: 'المفضلة', path: '/customer/wishlist' },
  { icon: Star, label: 'تقييماتي', path: '/customer/reviews' },
  { icon: MapPin, label: 'العناوين', path: '/customer/addresses' },
  { icon: Bell, label: 'الإشعارات', path: '/customer/notifications' },
  { icon: User, label: 'الملف الشخصي', path: '/customer/profile' },
];

export default function CustomerSidebar() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/customer/orders' && location.pathname === '/customer') return true;
    return location.pathname === path;
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-white/10">
        <Link to="/" className="block">
          <img src="/noufex-logo.svg" alt="نوف-إكس" className="h-10 mx-auto" />
        </Link>
        <div className="mt-4 flex items-center gap-3 justify-center">
          <div className="w-10 h-10 rounded-full bg-[#D4A853] flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-[#1A1612]" strokeWidth={1.5} />
          </div>
          <div className="text-right">
            <p className="text-white font-cairo font-semibold text-sm">أحمد محمد</p>
            <p className="text-[#AAAAAA] font-cairo text-xs">ahmed@example.com</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-cairo text-sm font-medium transition-all duration-200 ${
                active
                  ? 'bg-[#D4A853]/15 text-[#D4A853] border-l-3 border-l-[#D4A853]'
                  : 'text-[#AAAAAA] hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5 shrink-0" strokeWidth={1.5} />
              <span>{item.label}</span>
              {item.icon === Bell && (
                <span className="mr-auto w-2 h-2 bg-[#EF4444] rounded-full" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10">
        <Link
          to="/"
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-[#AAAAAA] hover:bg-white/5 hover:text-white transition-colors font-cairo text-sm"
        >
          <span>العودة للرئيسية</span>
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-20 right-4 z-40 w-10 h-10 bg-[#1A1612] rounded-full flex items-center justify-center shadow-lg"
        aria-label="القائمة"
      >
        <Menu className="w-5 h-5 text-white" strokeWidth={1.5} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-64 bg-[#1A1612] shadow-2xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 left-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/10"
            >
              <X className="w-4 h-4 text-white" strokeWidth={1.5} />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:block fixed right-0 top-0 bottom-0 w-60 bg-[#1A1612] z-40 overflow-y-auto">
        {sidebarContent}
      </aside>
    </>
  );
}
