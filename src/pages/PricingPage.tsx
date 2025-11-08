
import React from 'react';
import { PricingComparison } from '@/components/pricing/PricingComparison';
import { PricingSection } from '@/components/pricing/PricingSection';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Container } from '@/components/ui/container';
import { Check } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

export default function PricingPage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { t, isRTL } = useTranslation();
  
  const keyFeatures = [
    t('pricingPage.feature1'),
    t('pricingPage.feature2'),
    t('pricingPage.feature3'),
    t('pricingPage.feature4'),
  ];
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <Container className="mobile-section-padding">
        {/* Hero Section */}
        <div className="text-center mobile-container-padding mb-8 sm:mb-12">
          <h1 className={cn("section-title mobile-text-center mb-4 sm:mb-6", isRTL && "rtl-text")}>
            {t('pricingPage.title')}
          </h1>
          <p className={cn("section-subtitle mobile-text-center max-w-3xl mx-auto", isRTL && "rtl-text")}>
            {t('pricingPage.subtitle')}
          </p>
          
          {/* Key Features - Mobile Optimized */}
          <div className="mobile-grid-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6 sm:mt-8 max-w-4xl mx-auto">
            {keyFeatures.map((feature, index) => (
              <div key={index} className={cn(
                "flex items-center",
                isRTL ? "justify-center sm:justify-end text-center sm:text-right" : "justify-center sm:justify-start text-center sm:text-left"
              )}>
                <Check className={cn("mobile-icon text-warm-gold flex-shrink-0", isRTL ? "ml-2" : "mr-2")} />
                <span className={cn("text-xs sm:text-sm text-muted-foreground leading-relaxed", isRTL && "rtl-text")}>{feature}</span>
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
          <h2 className={cn("section-title text-center mobile-text-center mb-6 sm:mb-8", isRTL && "rtl-text")}>
            {t('pricingPage.comparisonTitle')}
          </h2>
          <PricingComparison />
        </div>

        {/* CTA Section */}
        <div className="mobile-container-padding bg-warm-gold/10 rounded-xl sm:rounded-2xl p-6 sm:p-8 border border-warm-gold/20 mb-16 sm:mb-24">
          <div className="text-center">
            <h3 className={cn("text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-dark-base", isRTL && "rtl-text")}>
              {t('pricingPage.ctaTitle')}
            </h3>
            <p className={cn("text-sm sm:text-lg mb-4 sm:mb-6 text-muted-foreground max-w-2xl mx-auto", isRTL && "rtl-text")}>
              {t('pricingPage.ctaSubtitle')}
            </p>
            <Button 
              size={isMobile ? "default" : "lg"}
              className="mobile-button-primary bg-warm-gold hover:bg-warm-gold/90 text-white"
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
              </a>
            </Button>
          </div>
        </div>

        {/* FAQ Section - Mobile Optimized */}
        <div className="mobile-container-padding">
          <h2 className={cn("section-title text-center mobile-text-center mb-6 sm:mb-8", isRTL && "rtl-text")}>
            {t('pricingPage.faqTitle')}
          </h2>
          <div className="mobile-grid-2 gap-4 sm:gap-6 lg:gap-8">
            <div className="mobile-card">
              <h3 className={cn("text-lg sm:text-xl font-medium mb-2 sm:mb-3 text-dark-base", isRTL && "rtl-text text-right")}>
                {t('pricingPage.faq1Question')}
              </h3>
              <p className={cn("text-sm sm:text-base text-muted-foreground leading-relaxed", isRTL && "rtl-text text-right")}>
                {t('pricingPage.faq1Answer')}
              </p>
            </div>
            <div className="mobile-card">
              <h3 className={cn("text-lg sm:text-xl font-medium mb-2 sm:mb-3 text-dark-base", isRTL && "rtl-text text-right")}>
                {t('pricingPage.faq2Question')}
              </h3>
              <p className={cn("text-sm sm:text-base text-muted-foreground leading-relaxed", isRTL && "rtl-text text-right")}>
                {t('pricingPage.faq2Answer')}
              </p>
            </div>
            <div className="mobile-card">
              <h3 className={cn("text-lg sm:text-xl font-medium mb-2 sm:mb-3 text-dark-base", isRTL && "rtl-text text-right")}>
                {t('pricingPage.faq3Question')}
              </h3>
              <p className={cn("text-sm sm:text-base text-muted-foreground leading-relaxed", isRTL && "rtl-text text-right")}>
                {t('pricingPage.faq3Answer')}
              </p>
            </div>
            <div className="mobile-card">
              <h3 className={cn("text-lg sm:text-xl font-medium mb-2 sm:mb-3 text-dark-base", isRTL && "rtl-text text-right")}>
                {t('pricingPage.faq4Question')}
              </h3>
              <p className={cn("text-sm sm:text-base text-muted-foreground leading-relaxed", isRTL && "rtl-text text-right")}>
                {t('pricingPage.faq4Answer')}
              </p>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
