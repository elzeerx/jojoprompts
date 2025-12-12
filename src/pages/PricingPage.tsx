import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { PricingComparison } from '@/components/pricing/PricingComparison';
import { PricingSection } from '@/components/pricing/PricingSection';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Container } from '@/components/ui/container';
import { Check, ArrowRight, Sparkles, Crown } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

export default function PricingPage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { t, isRTL } = useTranslation();
  const [searchParams] = useSearchParams();
  
  // Check if user was redirected from signup or prompts page
  const fromSignup = searchParams.get('from_signup') === 'true';
  const needsUpgrade = searchParams.get('upgrade') === 'true';
  
  const keyFeatures = [
    t('pricingPage.feature1'),
    t('pricingPage.feature2'),
    t('pricingPage.feature3'),
    t('pricingPage.feature4'),
  ];

  const faqs = [
    { question: t('pricingPage.faq1Question'), answer: t('pricingPage.faq1Answer') },
    { question: t('pricingPage.faq2Question'), answer: t('pricingPage.faq2Answer') },
    { question: t('pricingPage.faq3Question'), answer: t('pricingPage.faq3Answer') },
    { question: t('pricingPage.faq4Question'), answer: t('pricingPage.faq4Answer') },
  ];
  
  return (
    <div className="min-h-screen bg-white">
      <Container className="pt-20 lg:pt-24 pb-8">
        {/* Conversion Banner for redirected users */}
        {(fromSignup || needsUpgrade) && (
          <div className="mb-8 sm:mb-12 max-w-3xl mx-auto">
            <div className={cn(
              "rounded-2xl p-6 sm:p-8 text-center",
              "bg-gradient-to-r from-warm-gold/10 via-warm-gold/5 to-warm-gold/10",
              "border border-warm-gold/20"
            )}>
              <div className="flex items-center justify-center gap-2 mb-3">
                {fromSignup ? (
                  <Sparkles className="h-5 w-5 text-warm-gold" />
                ) : (
                  <Crown className="h-5 w-5 text-warm-gold" />
                )}
                <span className="text-sm font-semibold text-warm-gold uppercase tracking-wider">
                  {fromSignup ? "Welcome! One more step" : "Subscription Required"}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-dark-base mb-2">
                {fromSignup 
                  ? "Choose Your Plan to Unlock All Prompts" 
                  : "Subscribe to Access Premium Content"
                }
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                {fromSignup 
                  ? "Your account is ready! Select a plan below to get instant access to 500+ premium AI prompts."
                  : "The prompts you're trying to access require an active subscription. Choose a plan to continue."
                }
              </p>
            </div>
          </div>
        )}
        {/* Hero Section - Minimalist */}
        <div className="text-center mobile-container-padding mb-12 sm:mb-16">
          <h1 className={cn(
            "text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight text-dark-base mb-4 sm:mb-6",
            isRTL && "rtl-text"
          )}>
            {t('pricingPage.title').split(' ').map((word, i, arr) => (
              i === arr.length - 1 ? (
                <span key={i} className="text-warm-gold font-medium">{word}</span>
              ) : (
                <span key={i}>{word} </span>
              )
            ))}
          </h1>
          <p className={cn(
            "text-lg text-muted-foreground font-light max-w-2xl mx-auto",
            isRTL && "rtl-text"
          )}>
            {t('pricingPage.subtitle')}
          </p>
          
          {/* Key Features - Minimalist gap-px Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-gray-200 rounded-xl overflow-hidden mt-8 sm:mt-10 max-w-4xl mx-auto">
            {keyFeatures.map((feature, index) => (
              <div 
                key={index} 
                className={cn(
                  "bg-white p-4 sm:p-5 flex items-center gap-2 group hover:bg-gray-50/50 transition-colors duration-300",
                  isRTL ? "justify-center sm:justify-end" : "justify-center sm:justify-start"
                )}
              >
                <Check className={cn("h-4 w-4 text-warm-gold flex-shrink-0", isRTL ? "ml-2" : "mr-1")} />
                <span className={cn("text-sm text-muted-foreground", isRTL && "rtl-text")}>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing cards */}
        <div id="pricing" className="mb-16 sm:mb-24">
          <PricingSection />
        </div>

        {/* Pricing comparison table */}
        <div className="mb-16 sm:mb-24">
          <h2 className={cn(
            "text-2xl sm:text-3xl lg:text-4xl font-light tracking-tight text-dark-base text-center mb-8 sm:mb-10",
            isRTL && "rtl-text"
          )}>
            {t('pricingPage.comparisonTitle')}
          </h2>
          <PricingComparison />
        </div>

        {/* CTA Section - Minimalist Card */}
        <div className="mb-16 sm:mb-24">
          <div className="grid gap-px bg-gray-200 rounded-2xl overflow-hidden max-w-2xl mx-auto">
            <div className="bg-white p-8 sm:p-10 text-center group hover:bg-gray-50/50 transition-colors duration-300 relative">
              <h3 className={cn(
                "text-xl sm:text-2xl font-light tracking-tight text-dark-base mb-3",
                isRTL && "rtl-text"
              )}>
                {t('pricingPage.ctaTitle')}
              </h3>
              <p className={cn(
                "text-sm sm:text-base text-muted-foreground mb-6 max-w-md mx-auto font-light",
                isRTL && "rtl-text"
              )}>
                {t('pricingPage.ctaSubtitle')}
              </p>
              <Button 
                size={isMobile ? "default" : "lg"}
                className="bg-warm-gold hover:bg-warm-gold/90 text-white font-medium"
                asChild
              >
                <a href="#pricing" onClick={(e) => {
                  e.preventDefault();
                  const element = document.querySelector('#pricing');
                  if (element) {
                    const yOffset = isMobile ? -20 : -10;
                    const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
                    window.scrollTo({ top: y, behavior: 'smooth' });
                  }
                }}>
                  {t('pricingPage.ctaButton')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              
              {/* Subtle hover accent line */}
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-100 group-hover:bg-warm-gold/30 transition-colors duration-300" />
            </div>
          </div>
        </div>

        {/* FAQ Section - Minimalist gap-px Grid */}
        <div className="mobile-container-padding">
          <h2 className={cn(
            "text-2xl sm:text-3xl lg:text-4xl font-light tracking-tight text-dark-base text-center mb-8 sm:mb-10",
            isRTL && "rtl-text"
          )}>
            {t('pricingPage.faqTitle')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-gray-200 rounded-2xl overflow-hidden">
            {faqs.map((faq, index) => (
              <div 
                key={index} 
                className="bg-white p-6 sm:p-8 group hover:bg-gray-50/50 transition-colors duration-300 relative"
              >
                <h3 className={cn(
                  "text-base sm:text-lg font-medium mb-2 sm:mb-3 text-dark-base",
                  isRTL && "rtl-text text-right"
                )}>
                  {faq.question}
                </h3>
                <p className={cn(
                  "text-sm text-muted-foreground leading-relaxed font-light",
                  isRTL && "rtl-text text-right"
                )}>
                  {faq.answer}
                </p>
                
                {/* Subtle hover accent line */}
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-100 group-hover:bg-warm-gold/30 transition-colors duration-300" />
              </div>
            ))}
          </div>
        </div>
      </Container>
    </div>
  );
}
