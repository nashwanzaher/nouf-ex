const stats = [
	{ value: '+١٠,٠٠٠', label: 'تاجر نشط' },
	{ value: '+٥٠٠,٠٠٠', label: 'منتج متاح' },
	{ value: '+١,٠٠٠,٠٠٠', label: 'عميل سعيد' },
	{ value: '٩٨٪', label: 'معدل رضا العملاء' },
	{ value: '+٢٤', label: 'محافظة يمنية' },
	{ value: '٠٪', label: 'عمولة للبائعين الجدد' },
];

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
	const doubledStats = [...stats, ...stats];

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
