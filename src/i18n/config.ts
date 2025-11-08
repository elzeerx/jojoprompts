export type Language = 'en' | 'ar';

export const LANGUAGES: Record<Language, { name: string; nativeName: string; dir: 'ltr' | 'rtl' }> = {
  en: {
    name: 'English',
    nativeName: 'English',
    dir: 'ltr'
  },
  ar: {
    name: 'Arabic',
    nativeName: 'العربية',
    dir: 'rtl'
  }
};

export const DEFAULT_LANGUAGE: Language = 'en';
export const LANGUAGE_STORAGE_KEY = 'jojoprompts_language';

export function isValidLanguage(lang: string): lang is Language {
  return lang === 'en' || lang === 'ar';
}
