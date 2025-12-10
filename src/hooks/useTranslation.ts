import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Hook for accessing translation functionality
 * 
 * @example
 * const { t, language, setLanguage, isRTL } = useTranslation();
 * 
 * return <h1>{t('nav.home')}</h1>
 */
export function useTranslation() {
  const { t, language, setLanguage, dir, isRTL } = useLanguage();
  
  return {
    t,
    language,
    setLanguage,
    dir,
    isRTL
  };
}
