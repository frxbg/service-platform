import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import bg from './locales/bg.json';
import en from './locales/en.json';

const LANGUAGE_STORAGE_KEY = 'app-language';
const supportedLanguages = ['bg', 'en'] as const;

const getInitialLanguage = () => {
    if (typeof window === 'undefined') return 'bg';

    const storedLanguage =
        window.localStorage.getItem(LANGUAGE_STORAGE_KEY) ||
        window.localStorage.getItem('language');

    if (storedLanguage && supportedLanguages.includes(storedLanguage as (typeof supportedLanguages)[number])) {
        return storedLanguage;
    }

    const browserLanguage = window.navigator.language?.toLowerCase() || 'bg';
    return browserLanguage.startsWith('bg') ? 'bg' : 'en';
};

i18n
    .use(initReactI18next)
    .init({
        resources: {
            bg: {
                translation: bg,
            },
            en: {
                translation: en,
            },
        },
        lng: getInitialLanguage(),
        fallbackLng: 'bg',
        supportedLngs: supportedLanguages,
        interpolation: {
            escapeValue: false,
        },
    });

i18n.on('languageChanged', (language) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language;
});

if (typeof window !== 'undefined') {
    document.documentElement.lang = i18n.resolvedLanguage || i18n.language;
}

export default i18n;
