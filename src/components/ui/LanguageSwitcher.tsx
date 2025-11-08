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
}

export function LanguageSwitcher({ variant = 'desktop', className }: LanguageSwitcherProps) {
  const { language, setLanguage } = useTranslation();

  const isMobile = variant === 'mobile';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={isMobile ? 'default' : 'sm'}
          className={cn(
            'gap-2 min-h-[44px]',
            isMobile && 'w-full justify-start',
            className
          )}
        >
          <Globe className="h-4 w-4" />
          <span>{LANGUAGES[language].nativeName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-background z-50">
        {Object.entries(LANGUAGES).map(([lang, info]) => (
          <DropdownMenuItem
            key={lang}
            onClick={() => setLanguage(lang as Language)}
            className={cn(
              'cursor-pointer min-h-[44px]',
              language === lang && 'bg-warm-gold/10 text-warm-gold'
            )}
          >
            <span className="font-medium">{info.nativeName}</span>
            {language === lang && (
              <span className="ml-auto text-warm-gold">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
