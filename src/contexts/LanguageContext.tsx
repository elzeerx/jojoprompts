import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, LANGUAGES, isValidLanguage } from '@/i18n/config';
import enTranslations from '@/i18n/translations/en.json';
import arTranslations from '@/i18n/translations/ar.json';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string>) => string;
  dir: 'ltr' | 'rtl';
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations: Record<Language, any> = {
  en: enTranslations,
  ar: arTranslations
};

// Helper to get nested translation by key (e.g., "nav.home")
function getNestedTranslation(obj: any, path: string): string | undefined {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

// Helper to replace template variables (e.g., "{{year}}")
function replaceParams(text: string, params?: Record<string, string>): string {
  if (!params) return text;
  return Object.entries(params).reduce(
    (result, [key, value]) => result.replace(`{{${key}}}`, value),
    text
  );
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    // Try to load from localStorage
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && isValidLanguage(stored)) {
      return stored;
    }
    
    // Try to detect from browser
    const browserLang = navigator.language.split('-')[0];
    if (isValidLanguage(browserLang)) {
      return browserLang;
    }
    
    return DEFAULT_LANGUAGE;
  });

  const dir = LANGUAGES[language].dir;
  const isRTL = dir === 'rtl';

  useEffect(() => {
    // Update document attributes for RTL/LTR
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
    
    // Persist to localStorage
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language, dir]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: string, params?: Record<string, string>): string => {
    const translation = getNestedTranslation(translations[language], key);
    
    // Fallback to English if translation not found
    if (translation === undefined && language !== 'en') {
      const fallback = getNestedTranslation(translations.en, key);
      if (fallback !== undefined) {
        return replaceParams(fallback, params);
      }
    }
    
    // Return the translation or the key itself as last resort
    const text = translation !== undefined ? translation : key;
    return replaceParams(text, params);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dir, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
