/**
 * Trust stats row — Phase 5.
 *
 * Mirrors the web StatsMarquee. Counts come from /api/stats/home
 * (Redis-cached on the API side, TTL 30s).
 */
import { useTranslation } from 'react-i18next';
import { View, Text } from 'react-native';

interface Props {
	counts: {
		products: number;
		stores: number;
		orders: number;
		users: number;
	};
}

export function TrustStats({ counts }: Props) {
	const { t } = useTranslation();
	const stats = [
		{ label: t('home.products'), value: counts.products },
		{ label: t('home.stores'), value: counts.stores },
		{ label: t('home.orders'), value: counts.orders },
		{ label: t('home.customers'), value: counts.users },
	];
	return (
		<View className="bg-slate-50 px-6 py-6">
			<Text className="text-xs uppercase tracking-wider text-slate-500 mb-3 text-center">
				{t('home.trusted_by')}
			</Text>
			<View className="flex-row justify-between">
				{stats.map((s) => (
					<View key={s.label} className="items-center flex-1">
						<Text className="text-2xl font-bold text-slate-900">
							{s.value.toLocaleString()}
						</Text>
						<Text className="text-xs text-slate-500 mt-1">{s.label}</Text>
					</View>
				))}
			</View>
		</View>
	);
}