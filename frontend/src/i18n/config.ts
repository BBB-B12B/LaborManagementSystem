/**
 * i18n Configuration
 * การตั้งค่าระบบแปลภาษา (Thai/English)
 *
 * Configuration for react-i18next
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Thai translations
import thTranslations from './locales/th.json';
// English translations
import enTranslations from './locales/en.json';

// Language resources
const resources = {
  th: {
    translation: thTranslations,
  },
  en: {
    translation: enTranslations,
  },
};

// Only use LanguageDetector on client-side to avoid SSR hydration errors
if (typeof window !== 'undefined') {
  i18n.use(LanguageDetector);
}

i18n
  // Pass the i18n instance to react-i18next
  .use(initReactI18next)
  // Initialize i18next
  .init({
    resources,
    fallbackLng: 'th', // Default to Thai
    lng: typeof window !== 'undefined'
      ? (localStorage.getItem('i18nextLng') || 'th')
      : 'th', // Use localStorage only on client-side
    debug: process.env.NODE_ENV === 'development',

    interpolation: {
      escapeValue: false, // React already escapes values
    },

    detection: typeof window !== 'undefined' ? {
      // Order of language detection (client-side only)
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    } : undefined,

    react: {
      useSuspense: false,
    },
  });

export default i18n;
