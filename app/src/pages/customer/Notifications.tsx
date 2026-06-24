import { useState } from 'react';
import { Bell, ShoppingBag, Tag, Star, Info, CheckCheck, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CustomerSidebar from './CustomerSidebar';

type NotificationType = 'order' | 'promo' | 'review' | 'system';

interface Notification {
	id: number;
	type: NotificationType;
	title: string;
	message: string;
	time: string;
	read: boolean;
	link?: string;
}

const initialNotifications: Notification[] = [
	{
		id: 1,
		type: 'order',
		title: 'تم شحن طلبك',
		message: 'طلبك #NOUF-1235 تم شحنه وهو في طريقه إليك. التوصيل المتوقع خلال ٢-٣ أيام.',
		time: 'منذ ٣٠ دقيقة',
		read: false,
		link: '/customer/orders',
	},
	{
		id: 2,
		type: 'promo',
		title: 'خصم ٢٥% على الإلكترونيات',
		message:
			'استخدم كود NOUF25 واحصل على خصم ٢٥% على جميع منتجات الإلكترونيات. العرض ساري حتى نهاية الأسبوع.',
		time: 'منذ ساعتين',
		read: false,
		link: '/deals',
	},
	{
		id: 3,
		type: 'order',
		title: 'تم توصيل طلبك',
		message: 'طلبك #NOUF-1234 تم توصيله بنجاح. نأمل أن تكون راضياً عن عملية الشراء!',
		time: 'منذ ٥ ساعات',
		read: false,
		link: '/customer/orders',
	},
	{
		id: 4,
		type: 'review',
		title: 'رد على تقييمك',
		message: 'التاجر "حرف يمنية" رد على تقييمك لمنتج حقيبة جلدية يدوية.',
		time: 'منذ يوم',
		read: true,
		link: '/customer/reviews',
	},
	{
		id: 5,
		type: 'system',
		title: 'تحديث سياسة الخصوصية',
		message: 'قمنا بتحديث سياسة الخصوصية الخاصة بنا. يرجى الاطلاع على التحديثات الجديدة.',
		time: 'منذ يومين',
		read: true,
	},
	{
		id: 6,
		type: 'promo',
		title: 'نقاط نوف مجانية!',
		message:
			'لقد حصلت على ١٠٠ نقطة نوف بمناسبة عيد ميلاد المنصة. استخدمها في مشترياتك القادمة.',
		time: 'منذ ٣ أيام',
		read: true,
	},
	{
		id: 7,
		type: 'order',
		title: 'طلبك قيد المعالجة',
		message: 'طلبك #NOUF-1237 قيد المعالجة وسيتم شحنه قريباً.',
		time: 'منذ ٤ أيام',
		read: true,
		link: '/customer/orders',
	},
	{
		id: 8,
		type: 'system',
		title: 'تأكيد حسابك',
		message: 'يرجى تأكيد بريدك الإلكتروني لاستخدام جميع ميزات المنصة.',
		time: 'منذ أسبوع',
		read: true,
	},
];

const typeConfig: Record<
	NotificationType,
	{ icon: typeof ShoppingBag; color: string; bg: string }
> = {
	order: { icon: ShoppingBag, color: 'text-[#2563EB]', bg: 'bg-[#2563EB]/10' },
	promo: { icon: Tag, color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10' },
	review: { icon: Star, color: 'text-[#10B981]', bg: 'bg-[#10B981]/10' },
	system: { icon: Info, color: 'text-[#6B6B6B]', bg: 'bg-[#6B6B6B]/10' },
};

const filterTabs = [
	{ key: 'all', label: 'الكل' },
	{ key: 'unread', label: 'غير مقروء' },
	{ key: 'order', label: 'طلبات' },
	{ key: 'promo', label: 'عروض' },
];

export default function Notifications() {
	const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
	const [activeFilter, setActiveFilter] = useState('all');

	const markAllRead = () => {
		setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
	};

	const markAsRead = (id: number) => {
		setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
	};

	const filtered = notifications.filter((n) => {
		if (activeFilter === 'all') return true;
		if (activeFilter === 'unread') return !n.read;
		return n.type === activeFilter;
	});

	const unreadCount = notifications.filter((n) => !n.read).length;

	return (
		<div className="min-h-[100dvh] bg-[#F8F8F8]" dir="rtl">
			<CustomerSidebar />

			<div className="md:mr-60 min-h-[100dvh]">
				<div className="bg-white border-b border-[#F3EDE4] px-6 py-4 sticky top-0 z-30 flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-amiri font-bold text-[#1A1612]">الإشعارات</h1>
						<p className="text-sm text-[#6B6B6B] font-cairo mt-1">
							{unreadCount > 0
								? `لديك ${unreadCount} إشعارات جديدة`
								: 'لا توجد إشعارات جديدة'}
						</p>
					</div>
					{unreadCount > 0 && (
						<Button
							variant="ghost"
							onClick={markAllRead}
							className="font-cairo text-sm text-[#D4A853] hover:text-[#c49a48] hover:bg-[#F3EDE4] rounded-xl"
						>
							<CheckCheck className="w-4 h-4 ml-1" strokeWidth={1.5} />
							تعيين الكل كمقروء
						</Button>
					)}
				</div>

				<div className="p-6 max-w-3xl mx-auto space-y-4">
					{/* Filter tabs */}
					<div className="flex gap-2 overflow-x-auto pb-2">
						{filterTabs.map((f) => (
							<button
								key={f.key}
								onClick={() => setActiveFilter(f.key)}
								className={`px-4 py-2 rounded-full text-sm font-cairo font-medium whitespace-nowrap transition-colors ${
									activeFilter === f.key
										? 'bg-[#D4A853] text-[#1A1612]'
										: 'bg-white text-[#6B6B6B] hover:bg-[#F3EDE4]'
								}`}
							>
								{f.key === 'all' && `الكل (${notifications.length})`}
								{f.key === 'unread' && `غير مقروء (${unreadCount})`}
								{f.key === 'order' && 'طلبات'}
								{f.key === 'promo' && 'عروض'}
							</button>
						))}
					</div>

					{/* Notifications list */}
					{filtered.length === 0 ? (
						<div className="bg-white rounded-2xl p-12 text-center shadow-sm">
							<Bell
								className="w-16 h-16 text-[#AAAAAA] mx-auto mb-4"
								strokeWidth={1}
							/>
							<h3 className="text-xl font-amiri font-bold text-[#1A1612] mb-2">
								لا إشعارات جديدة
							</h3>
							<p className="text-[#6B6B6B] font-cairo text-sm">
								ستظهر إشعاراتك الجديدة هنا
							</p>
						</div>
					) : (
						<div className="space-y-2">
							{filtered.map((n) => {
								const config = typeConfig[n.type];
								const Icon = config.icon;
								return (
									<div
										key={n.id}
										onClick={() => markAsRead(n.id)}
										className={`bg-white rounded-xl p-4 flex items-start gap-4 cursor-pointer transition-all hover:shadow-sm ${
											!n.read
												? 'border-l-3 border-l-[#D4A853] bg-[#F3EDE4]/30'
												: ''
										}`}
									>
										<div
											className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center shrink-0`}
										>
											<Icon
												className={`w-5 h-5 ${config.color}`}
												strokeWidth={1.5}
											/>
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2 mb-1">
												<p
													className={`font-cairo text-sm ${!n.read ? 'font-semibold' : 'font-medium'} text-[#111111]`}
												>
													{n.title}
												</p>
												{!n.read && (
													<span className="w-2 h-2 bg-[#D4A853] rounded-full shrink-0" />
												)}
											</div>
											<p className="text-xs text-[#6B6B6B] font-cairo leading-relaxed line-clamp-2">
												{n.message}
											</p>
											<p className="text-[10px] text-[#AAAAAA] font-cairo mt-2">
												{n.time}
											</p>
										</div>
										<ChevronLeft
											className="w-4 h-4 text-[#AAAAAA] shrink-0 self-center"
											strokeWidth={1.5}
										/>
									</div>
								);
							})}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
