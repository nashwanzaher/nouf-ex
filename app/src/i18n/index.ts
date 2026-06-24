import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import ar from './locales/ar.json';
import en from './locales/en.json';
import zh from './locales/zh.json';

const resources = { ar: { translation: ar }, en: { translation: en }, zh: { translation: zh } };

i18n.use(LanguageDetector)
	.use(initReactI18next)
	.init({
		resources,
		fallbackLng: 'ar',
		supportedLngs: ['ar', 'en', 'zh'],
		interpolation: { escapeValue: false },
		detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'] },
	});

export default i18n;
