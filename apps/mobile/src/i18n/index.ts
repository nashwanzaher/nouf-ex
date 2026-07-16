/**
 * i18n setup — Phase 5.
 *
 * Same locales (ar/en/zh) as the web app; loads translations from a
 * bundled JSON resource so the first paint has the right strings
 * without a network round-trip.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import ar from './locales/ar.json';
import en from './locales/en.json';
import zh from './locales/zh.json';

const locales = getLocales();
const deviceLang = locales[0]?.languageCode ?? 'en';

void i18n.use(initReactI18next).init({
	resources: {
		ar: { translation: ar },
		en: { translation: en },
		zh: { translation: zh },
	},
	lng: ['ar', 'en', 'zh'].includes(deviceLang) ? deviceLang : 'en',
	fallbackLng: 'en',
	interpolation: { escapeValue: false },
	react: { useSuspense: false },
});

export { i18n };
export const supportedLanguages = ['ar', 'en', 'zh'] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];