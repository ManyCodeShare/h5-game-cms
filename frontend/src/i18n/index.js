import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import es from './locales/es.json';
import pt from './locales/pt.json';
import ar from './locales/ar.json';
import fr from './locales/fr.json';

// 语言资源
const resources = {
  en: { translation: en },
  es: { translation: es },
  pt: { translation: pt },
  ar: { translation: ar },
  fr: { translation: fr }
};

// 支持的语言列表
export const supportedLanguages = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'pt', name: 'Português' },
  { code: 'ar', name: 'العربية' },
  { code: 'fr', name: 'Français' }
];

i18n
  // 检测用户语言
  .use(LanguageDetector)
  // 传递 the i18n instance to react-i18next.
  .use(initReactI18next)
  // 初始化 i18next
  .init({
    resources,
    fallbackLng: 'en',
    debug: false,
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
    detection: {
      order: ['querystring', 'cookie', 'localStorage', 'navigator'],
      caches: ['localStorage', 'cookie'],
    }
  });

// 根据语言设置调整文档方向（主要针对阿拉伯语等RTL语言）
i18n.on('languageChanged', (lng) => {
  document.documentElement.dir = ['ar'].includes(lng) ? 'rtl' : 'ltr';
  document.documentElement.lang = lng;
});

export default i18n;
