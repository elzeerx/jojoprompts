import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/hooks/useTranslation';
import { LANGUAGES, Language } from '@/i18n/config';
import { cn } from '@/lib/utils';

interface LanguageSwitcherProps {
  variant?: 'desktop' | 'mobile';
  className?: string;
  isScrolled?: boolean;
}

export function LanguageSwitcher({ variant = 'desktop', className, isScrolled }: LanguageSwitcherProps) {
  const { language, setLanguage } = useTranslation();

  const isMobile = variant === 'mobile';
  const languageCode = language.toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={isMobile ? 'default' : 'sm'}
          className={cn(
            'gap-1.5 min-h-[44px] transition-colors',
            isMobile 
              ? 'w-full justify-start text-white/90 hover:text-warm-gold hover:bg-white/10' 
              : 'text-white/90 hover:text-warm-gold hover:bg-white/10 px-3',
            className
          )}
        >
          <Globe className="h-4 w-4" />
          <span className="text-xs font-semibold">{languageCode}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="bg-dark-base/95 backdrop-blur-md border border-white/10 z-50 min-w-[140px]"
      >
        {Object.entries(LANGUAGES).map(([lang, info]) => (
          <DropdownMenuItem
            key={lang}
            onClick={() => setLanguage(lang as Language)}
            className={cn(
              'cursor-pointer min-h-[44px] hover:bg-white/10 transition-colors',
              language === lang && 'bg-warm-gold/20 text-warm-gold'
            )}
          >
            <span className={cn(
              "font-medium",
              language === lang ? "text-warm-gold" : "text-white/90"
            )}>
              {info.nativeName}
            </span>
            {language === lang && (
              <span className="ml-auto text-warm-gold">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
