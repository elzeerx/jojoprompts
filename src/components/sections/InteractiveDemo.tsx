import React, { useState } from 'react';
import { Check, X, ArrowRight, Sparkles, Copy, CheckCircle } from 'lucide-react';
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
    <section className="mobile-section-padding text-white">
      <Container>
        {/* Header */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className={cn("text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 text-white animate-fade-in", isRTL && "rtl-text")}>
            {t('interactiveDemo.title')}
            <span className={cn(
              "text-transparent bg-clip-text bg-gradient-to-r from-warm-gold to-muted-teal block sm:inline",
              isRTL ? "sm:mr-3" : "sm:ml-3"
            )}>
              {t('interactiveDemo.titleHighlight')}
            </span>
          </h2>
          <p className={cn("text-white/70 text-base sm:text-lg max-w-2xl mx-auto animate-fade-in delay-200", isRTL && "rtl-text")}>
            {t('interactiveDemo.subtitle')}
          </p>
        </div>

        {/* Demo Categories */}
        <div className="flex flex-wrap gap-2 sm:gap-4 justify-center mb-8 sm:mb-12">
          {demoPrompts.map((demo, index) => (
            <Button
              key={index}
              variant={activeDemo === index ? "default" : "outline"}
              onClick={() => setActiveDemo(index)}
              className={`mobile-tab transition-all duration-300 ${
                activeDemo === index 
                  ? 'bg-warm-gold text-white shadow-lg scale-105' 
                  : 'border-warm-gold/30 hover:border-warm-gold/50'
              }`}
            >
              {demo.category}
            </Button>
          ))}
        </div>

        {/* Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12 max-w-6xl mx-auto">
          {/* Generic Prompt */}
          <div className="space-y-4 sm:space-y-6 animate-fade-in">
            <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
              <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center">
                <X className="h-5 w-5 text-red-400" />
              </div>
              <h3 className={cn("text-xl sm:text-2xl font-bold text-white/90", isRTL && "rtl-text")}>
                {t('interactiveDemo.genericPromptTitle')}
              </h3>
            </div>
            
            <div className="bg-white border-2 border-red-200 rounded-xl p-4 sm:p-6 relative group hover:shadow-lg transition-all duration-300">
              <div className={cn("absolute top-3", isRTL ? "left-3" : "right-3")}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(demoPrompts[activeDemo].generic, 'generic')}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {copiedPrompt === 'generic' ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              
              <p className={cn("text-gray-600 text-sm sm:text-base leading-relaxed mb-4", isRTL && "rtl-text text-right")}>
                {demoPrompts[activeDemo].generic}
              </p>
              
              <div className="border-t border-red-100 pt-4">
                <p className={cn("text-red-600 text-sm font-medium flex items-center gap-2", isRTL && "flex-row-reverse rtl-text")}>
                  <X className="h-4 w-4" />
                  {t('interactiveDemo.resultLabel')} {demoPrompts[activeDemo].results.generic}
                </p>
              </div>
            </div>
          </div>

          {/* Premium Prompt */}
          <div className="space-y-4 sm:space-y-6 animate-fade-in delay-200">
            <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
              <div className="w-8 h-8 bg-gradient-to-r from-warm-gold to-muted-teal rounded-full flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <h3 className={cn("text-xl sm:text-2xl font-bold text-warm-gold", isRTL && "rtl-text")}>
                {t('interactiveDemo.premiumPromptTitle')}
              </h3>
            </div>
            
            <div className="bg-gradient-to-br from-warm-gold/5 to-muted-teal/5 border-2 border-warm-gold/30 rounded-xl p-4 sm:p-6 relative group hover:shadow-xl hover:border-warm-gold/50 transition-all duration-300">
              <div className={cn("absolute top-3", isRTL ? "left-3" : "right-3")}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(demoPrompts[activeDemo].premium, 'premium')}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {copiedPrompt === 'premium' ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              
              <p className={cn("text-dark-base text-sm sm:text-base leading-relaxed mb-4", isRTL && "rtl-text text-right")}>
                {demoPrompts[activeDemo].premium}
              </p>
              
              <div className="border-t border-warm-gold/20 pt-4">
                <p className={cn("text-green-600 text-sm font-medium flex items-center gap-2", isRTL && "flex-row-reverse rtl-text")}>
                  <Check className="h-4 w-4" />
                  {t('interactiveDemo.resultLabel')} {demoPrompts[activeDemo].results.premium}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-12 sm:mt-16">
          <Button 
            asChild
            size="lg"
            className="mobile-button-primary bg-gradient-to-r from-warm-gold to-muted-teal hover:from-warm-gold/90 hover:to-muted-teal/90 text-white font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
          >
            <a href="#pricing" className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <Sparkles className="h-5 w-5" />
              {t('interactiveDemo.ctaButton')}
              <ArrowRight className={cn("h-5 w-5", isRTL && "rotate-180")} />
            </a>
          </Button>
          <p className={cn("text-white/60 text-sm mt-3", isRTL && "rtl-text")}>
            {t('interactiveDemo.ctaSubtext')}
          </p>
        </div>
      </Container>
    </section>
  );
}
