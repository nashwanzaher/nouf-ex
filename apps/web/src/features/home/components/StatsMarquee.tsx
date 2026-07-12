import { useTranslation } from 'react-i18next';
import { useHomeStats } from '@/hooks/useApi';

function StatItem({ value, label }: { value: string; label: string }) {
	return (
		<div className="flex items-center gap-4 shrink-0 px-6">
			<div className="text-center">
				<span className="block text-[#D4A853] font-mono text-xl md:text-2xl lg:text-4xl font-bold leading-tight">
					{value}
				</span>
				<span className="block text-[#AAAAAA] text-xs md:text-sm font-cairo mt-1">
					{label}
				</span>
			</div>
			<span className="text-[#D4A853] text-lg md:text-xl">◆</span>
		</div>
	);
}

export default function StatsMarquee() {
	const { t } = useTranslation();
	const { data: stats, loading } = useHomeStats();

	const statItems = loading
		? [
				{ value: '...', label: t('home.stats.loading', 'جاري التحميل') },
				{ value: '...', label: t('home.stats.loading', 'جاري التحميل') },
				{ value: '...', label: t('home.stats.loading', 'جاري التحميل') },
				{ value: '...', label: t('home.stats.loading', 'جاري التحميل') },
			]
		: [
				{
					value: stats?.stores_count
						? `+${stats.stores_count.toLocaleString('ar-EG')}`
						: '+٠',
					label: t('home.stats.stores', 'تاجر نشط'),
				},
				{
					value: stats?.products_count
						? `+${stats.products_count.toLocaleString('ar-EG')}`
						: '+٠',
					label: t('home.stats.products', 'منتج متاح'),
				},
				{
					value: stats?.users_count
						? `+${stats.users_count.toLocaleString('ar-EG')}`
						: '+٠',
					label: t('home.stats.users', 'عميل سعيد'),
				},
				{
					value: stats?.orders_count
						? `+${stats.orders_count.toLocaleString('ar-EG')}`
						: '+٠',
					label: t('home.stats.orders', 'طلبية مكتملة'),
				},
			];

	const doubledStats = [...statItems, ...statItems];

	return (
		<section
			className="bg-[#1A1612] py-5 border-y border-[rgba(212,168,83,0.2)] overflow-hidden"
			dir="rtl"
		>
			<div className="animate-marquee pause-on-hover flex items-center w-max">
				{doubledStats.map((stat, i) => (
					<StatItem key={i} value={stat.value} label={stat.label} />
				))}
			</div>
		</section>
	);
}