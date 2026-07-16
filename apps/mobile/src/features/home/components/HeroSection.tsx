/**
 * Hero section — Phase 5.
 *
 * Replicates the web Home hero: greeting, search bar, trust badges.
 * The search bar is a controlled TextInput that pushes to the
 * `/search` tab on submit.
 */
import { useTranslation } from 'react-i18next';
import { View, Text, TextInput, Pressable } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export function HeroSection() {
	const { t } = useTranslation();
	const router = useRouter();
	const [q, setQ] = useState('');

	function submit() {
		const trimmed = q.trim();
		if (!trimmed) return;
		router.push({ pathname: '/search', params: { q: trimmed } });
	}

	return (
		<View className="bg-primary-600 px-6 pt-12 pb-10">
			<Text className="text-white text-2xl font-bold mb-1">{t('home.hero_title')}</Text>
			<Text className="text-primary-100 text-base mb-6">{t('home.hero_subtitle')}</Text>
			<View className="bg-white rounded-full flex-row items-center px-4 py-3 shadow-lg">
				<Ionicons name="search" size={20} color="#0d9488" />
				<TextInput
					value={q}
					onChangeText={setQ}
					onSubmitEditing={submit}
					placeholder={t('home.search_placeholder')}
					placeholderTextColor="#94a3b8"
					className="flex-1 mx-2 text-base text-slate-900"
					returnKeyType="search"
				/>
				<Pressable onPress={submit} className="bg-primary-600 px-3 py-1 rounded-full">
					<Text className="text-white text-sm font-medium">→</Text>
				</Pressable>
			</View>
		</View>
	);
}