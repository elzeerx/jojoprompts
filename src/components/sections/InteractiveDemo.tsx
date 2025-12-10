import React, { useState } from 'react';
import { Check, X, ArrowRight, Copy, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { useCopyToClipboard } from "@/hooks/ui/useCopyToClipboard";
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

export function InteractiveDemo() {
  const { t, isRTL } = useTranslation();
  const [activeDemo, setActiveDemo] = useState(0);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const { copyToClipboard: copy } = useCopyToClipboard();

  const demoPrompts = [
    {
      category: t('interactiveDemo.categoryCreative'),
      generic: t('interactiveDemo.demo1Generic'),
      premium: t('interactiveDemo.demo1Premium'),
      results: {
        generic: t('interactiveDemo.demo1ResultGeneric'),
        premium: t('interactiveDemo.demo1ResultPremium')
      }
    },
    {
      category: t('interactiveDemo.categoryBusiness'),
      generic: t('interactiveDemo.demo2Generic'),
      premium: t('interactiveDemo.demo2Premium'),
      results: {
        generic: t('interactiveDemo.demo2ResultGeneric'),
        premium: t('interactiveDemo.demo2ResultPremium')
      }
    },
    {
      category: t('interactiveDemo.categoryArabic'),
      generic: t('interactiveDemo.demo3Generic'),
      premium: t('interactiveDemo.demo3Premium'),
      results: {
        generic: t('interactiveDemo.demo3ResultGeneric'),
        premium: t('interactiveDemo.demo3ResultPremium')
      }
    }
  ];

  const copyToClipboard = (text: string, type: string) => {
    copy(text);
    setCopiedPrompt(type);
    setTimeout(() => setCopiedPrompt(null), 2000);
  };

  return (
    <section className="mobile-section-padding bg-white">
      <Container>
        {/* Header */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className={cn("section-title", isRTL && "rtl-text")}>
            {t('interactiveDemo.title')}
            <span className={cn(
              "text-warm-gold block sm:inline",
              isRTL ? "sm:mr-3" : "sm:ml-3"
            )}>
              {t('interactiveDemo.titleHighlight')}
            </span>
          </h2>
          <p className={cn("section-subtitle", isRTL && "rtl-text")}>
            {t('interactiveDemo.subtitle')}
          </p>
        </div>

        {/* Demo Categories - Minimal Tab Style */}
        <div className="flex flex-wrap gap-1 justify-center mb-10 sm:mb-14 border-b border-gray-200 pb-4">
          {demoPrompts.map((demo, index) => (
            <button
              key={index}
              onClick={() => setActiveDemo(index)}
              className={cn(
                "px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-medium transition-all duration-200 relative",
                activeDemo === index 
                  ? 'text-warm-gold' 
                  : 'text-muted-foreground hover:text-dark-base'
              )}
            >
              {demo.category}
              {activeDemo === index && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-warm-gold -mb-4" />
              )}
            </button>
          ))}
        </div>

        {/* Comparison - Minimalist Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-gray-200 rounded-2xl overflow-hidden max-w-5xl mx-auto">
          {/* Generic Prompt */}
          <div className="bg-white p-6 sm:p-8 lg:p-10 group">
            <div className={cn("flex items-center gap-3 mb-6", isRTL && "flex-row-reverse")}>
              <div className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center">
                <X className="h-4 w-4 text-muted-foreground" />
              </div>
              <h3 className={cn("text-lg sm:text-xl font-semibold text-dark-base", isRTL && "rtl-text")}>
                {t('interactiveDemo.genericPromptTitle')}
              </h3>
            </div>
            
            <div className="relative mb-6">
              <div className={cn("absolute top-2", isRTL ? "left-2" : "right-2")}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(demoPrompts[activeDemo].generic, 'generic')}
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                >
                  {copiedPrompt === 'generic' ? (
                    <CheckCircle className="h-4 w-4 text-warm-gold" />
                  ) : (
                    <Copy className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              
              <p className={cn("text-muted-foreground text-sm sm:text-base leading-relaxed pr-10", isRTL && "rtl-text text-right pl-10 pr-0")}>
                {demoPrompts[activeDemo].generic}
              </p>
            </div>
            
            <div className="pt-4 border-t border-gray-100">
              <p className={cn("text-muted-foreground text-sm flex items-center gap-2", isRTL && "flex-row-reverse rtl-text")}>
                <X className="h-4 w-4" />
                {t('interactiveDemo.resultLabel')} {demoPrompts[activeDemo].results.generic}
              </p>
            </div>
            
            {/* Hover indicator line */}
            <div className="h-px bg-gray-100 group-hover:bg-gray-200 transition-colors duration-300 mt-6" />
          </div>

          {/* Premium Prompt */}
          <div className="bg-white p-6 sm:p-8 lg:p-10 group">
            <div className={cn("flex items-center gap-3 mb-6", isRTL && "flex-row-reverse")}>
              <div className="w-8 h-8 rounded-full border border-warm-gold/40 flex items-center justify-center">
                <Check className="h-4 w-4 text-warm-gold" />
              </div>
              <h3 className={cn("text-lg sm:text-xl font-semibold text-dark-base", isRTL && "rtl-text")}>
                {t('interactiveDemo.premiumPromptTitle')}
              </h3>
            </div>
            
            <div className="relative mb-6">
              <div className={cn("absolute top-2", isRTL ? "left-2" : "right-2")}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(demoPrompts[activeDemo].premium, 'premium')}
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                >
                  {copiedPrompt === 'premium' ? (
                    <CheckCircle className="h-4 w-4 text-warm-gold" />
                  ) : (
                    <Copy className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              
              <p className={cn("text-dark-base text-sm sm:text-base leading-relaxed pr-10", isRTL && "rtl-text text-right pl-10 pr-0")}>
                {demoPrompts[activeDemo].premium}
              </p>
            </div>
            
            <div className="pt-4 border-t border-warm-gold/10">
              <p className={cn("text-warm-gold text-sm flex items-center gap-2", isRTL && "flex-row-reverse rtl-text")}>
                <Check className="h-4 w-4" />
                {t('interactiveDemo.resultLabel')} {demoPrompts[activeDemo].results.premium}
              </p>
            </div>
            
            {/* Hover indicator line */}
            <div className="h-px bg-gray-100 group-hover:bg-warm-gold/30 transition-colors duration-300 mt-6" />
          </div>
        </div>

        {/* CTA - Minimal */}
        <div className="text-center mt-12 sm:mt-16">
          <Button 
            asChild
            size="lg"
            className="bg-warm-gold hover:bg-warm-gold/90 text-white font-semibold px-8"
          >
            <a href="#pricing" className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
              {t('interactiveDemo.ctaButton')}
              <ArrowRight className={cn("h-4 w-4", isRTL && "rotate-180")} />
            </a>
          </Button>
          <p className={cn("text-muted-foreground text-sm mt-3", isRTL && "rtl-text")}>
            {t('interactiveDemo.ctaSubtext')}
          </p>
        </div>
      </Container>
    </section>
  );
}
