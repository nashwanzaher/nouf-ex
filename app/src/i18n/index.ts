import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
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
		// SEC-P2-02 (added 2026-07-02): React's render layer already
		// escapes string children (so `<div>{t('key')}</div>` cannot
		// inject HTML). Setting escapeValue here to `true` would
		// double-escape and break any translation that intentionally
		// contains inline markup (e.g. <strong>, <br/>). The locale
		// JSON files MUST be treated as trusted code-review artefacts,
		// not user input. Do not change this without a security review.
		interpolation: { escapeValue: false },
		detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'] },
	});

export default i18n;
