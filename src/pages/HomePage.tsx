import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check } from "lucide-react";
import { PricingSection } from "@/components/pricing/PricingSection";
import { EnhancedHeroSection } from "@/components/sections/EnhancedHeroSection";
import { FeatureHighlights } from "@/components/sections/FeatureHighlights";
import { InteractiveDemo } from "@/components/sections/InteractiveDemo";
import { CategoryShowcase } from "@/components/sections/CategoryShowcase";
import { TrustSignals } from "@/components/sections/TrustSignals";
import { useAuth } from "@/contexts/AuthContext";
import { Container } from "@/components/ui/container";
import { useIsMobile } from '@/hooks/use-mobile';
import { createLogger } from '@/utils/logging';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

const logger = createLogger('HOME_PAGE');

export default function HomePage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { t, isRTL } = useTranslation();

  logger.debug('HomePage mounted', { hasUser: !!user, isMobile });

  return (
    <main className="min-h-screen bg-white">
      {/* Enhanced Hero Section */}
      <EnhancedHeroSection />

      {/* Feature Highlights */}
      <FeatureHighlights />
      
      {/* Interactive Demo */}
      <InteractiveDemo />
      
      {/* Category Showcase */}
      <CategoryShowcase />
      
      {/* Trust Signals */}
      <TrustSignals />
      
      {/* Pricing Preview (only shown if user is not logged in) */}
      {!user && (
        <section id="pricing" className="mobile-section-padding bg-gray-50">
          <Container>
            <div className="text-center mb-8 sm:mb-12 mobile-container-padding">
              <h2 className={cn("section-title mobile-text-center", isRTL && "rtl-text")}>
                {t('homepage.pricingTitle')}
                <span className={cn(
                  "text-warm-gold block sm:inline",
                  isRTL ? "sm:mr-3" : "sm:ml-3"
                )}>
                  {t('homepage.pricingTitleHighlight')}
                </span>
              </h2>
              <p className={cn("section-subtitle mobile-text-center", isRTL && "rtl-text")}>
                {t('homepage.pricingSubtitle')}
              </p>
              
              {/* Urgency indicator - Simplified */}
              <div className={cn(
                "inline-flex items-center gap-2 text-warm-gold text-sm font-medium mt-4",
                isRTL && "flex-row-reverse"
              )}>
                <span>🔥</span>
                <span>{t('homepage.pricingUrgency')}</span>
              </div>
            </div>
            <PricingSection />
          </Container>
        </section>
      )}

      {/* Final Call To Action - Minimalist Light Version */}
      <section className="mobile-section-padding bg-white border-t border-gray-200">
        <Container className="text-center mobile-container-padding">
          <div className="max-w-3xl mx-auto">
            <h2 className={cn(
              "text-2xl sm:text-3xl md:text-4xl font-semibold text-dark-base mb-4 sm:mb-6",
              isRTL && "rtl-text"
            )}>
              {t('homepage.finalCtaTitle')}
              <span className={cn(
                "text-warm-gold block sm:inline",
                isRTL ? "sm:mr-3" : "sm:ml-3"
              )}>
                {t('homepage.finalCtaTitleHighlight')}
              </span>
            </h2>
            <p className={cn(
              "text-muted-foreground text-base sm:text-lg mb-8 max-w-2xl mx-auto",
              isRTL && "rtl-text"
            )}>
              {t('homepage.finalCtaSubtitle')}{' '}
              <span className="text-warm-gold font-medium">{t('homepage.finalCtaHighlight')}</span>
            </p>
            
            {/* Benefits row - Simple inline */}
            <div className={cn(
              "flex flex-wrap gap-4 sm:gap-6 justify-center mb-8 text-sm",
              isRTL && "flex-row-reverse"
            )}>
              <div className={cn("flex items-center gap-2 text-muted-foreground", isRTL && "flex-row-reverse")}>
                <Check className="h-4 w-4 text-warm-gold" />
                <span>{t('homepage.finalCtaBenefit1')}</span>
              </div>
              <div className={cn("flex items-center gap-2 text-muted-foreground", isRTL && "flex-row-reverse")}>
                <Check className="h-4 w-4 text-warm-gold" />
                <span>{t('homepage.finalCtaBenefit2')}</span>
              </div>
              <div className={cn("flex items-center gap-2 text-muted-foreground", isRTL && "flex-row-reverse")}>
                <Check className="h-4 w-4 text-warm-gold" />
                <span>{t('homepage.finalCtaBenefit3')}</span>
              </div>
            </div>
            
            <div className={cn(
              "space-y-4 sm:space-y-0 sm:flex sm:justify-center sm:items-center",
              isRTL ? "sm:space-x-reverse sm:space-x-4" : "sm:space-x-4"
            )}>
              <Button 
                asChild 
                size={isMobile ? "default" : "lg"}
                className="bg-warm-gold hover:bg-warm-gold/90 text-white font-semibold px-8"
              >
                <Link to={user ? "/prompts" : "/pricing"} className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                  {user ? t('homepage.finalCtaButtonUser') : t('homepage.finalCtaButton')}
                  <ArrowRight className={cn("h-4 w-4", isRTL && "rotate-180")} />
                </Link>
              </Button>
              
              {!user && (
                <p className={cn("text-warm-gold text-sm font-medium", isRTL && "rtl-text")}>
                  🚀 {t('homepage.finalCtaMessage')}
                </p>
              )}
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}
