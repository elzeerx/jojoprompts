
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";
import { PricingSection } from "@/components/pricing/PricingSection";
import { HeroSectionV2 } from "@/components/sections/HeroSectionV2";
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
    <main className="min-h-screen">
      {/* New Hero Section V2 */}
      <HeroSectionV2 />

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
        <section id="pricing" className="mobile-section-padding bg-white/10 backdrop-blur-sm">
          <Container>
            <div className="text-center mb-8 sm:mb-12 mobile-container-padding">
              <h2 className={cn("section-title mobile-text-center", isRTL && "rtl-text")}>
                {t('homepage.pricingTitle')}
                <span className={cn(
                  "text-transparent bg-clip-text bg-gradient-to-r from-warm-gold to-muted-teal block sm:inline",
                  isRTL ? "sm:mr-3" : "sm:ml-3"
                )}>
                  {t('homepage.pricingTitleHighlight')}
                </span>
              </h2>
              <p className={cn("section-subtitle mobile-text-center", isRTL && "rtl-text")}>
                {t('homepage.pricingSubtitle')}
              </p>
              
              {/* Urgency indicator */}
              <div className={cn(
                "inline-flex items-center gap-2 bg-warm-gold/10 border border-warm-gold/20 rounded-full px-4 py-2 mt-4",
                isRTL && "flex-row-reverse"
              )}>
                <span className="animate-pulse-gentle">🔥</span>
                <span className="text-warm-gold font-medium text-sm">{t('homepage.pricingUrgency')}</span>
              </div>
            </div>
            <PricingSection />
          </Container>
        </section>
      )}

      {/* Final Call To Action */}
      <section className="mobile-section-padding bg-gradient-to-br from-dark-base via-dark-base/95 to-warm-gold/20 text-white backdrop-blur-sm relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-10 left-10 w-32 h-32 bg-warm-gold/20 rounded-full blur-3xl animate-pulse-gentle"></div>
          <div className="absolute bottom-10 right-10 w-40 h-40 bg-muted-teal/20 rounded-full blur-3xl animate-pulse-gentle" style={{ animationDelay: '1s' }}></div>
        </div>
        
        <Container className="text-center mobile-container-padding relative z-10">
          <div className="max-w-4xl mx-auto">
            <h2 className={cn(
              "text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 mobile-text-center animate-fade-in",
              isRTL && "rtl-text"
            )}>
              {t('homepage.finalCtaTitle')}
              <span className={cn(
                "text-transparent bg-clip-text bg-gradient-to-r from-warm-gold to-muted-teal block sm:inline",
                isRTL ? "sm:mr-3" : "sm:ml-3"
              )}>
                {t('homepage.finalCtaTitleHighlight')}
              </span>
            </h2>
            <p className={cn(
              "text-base sm:text-lg lg:text-xl mb-6 sm:mb-8 max-w-3xl mx-auto opacity-90 mobile-text-center animate-fade-in delay-200",
              isRTL && "rtl-text"
            )}>
              {t('homepage.finalCtaSubtitle')}{' '}
              <span className="text-warm-gold font-semibold">{t('homepage.finalCtaHighlight')}</span>
            </p>
            
            {/* Benefits row */}
            <div className={cn(
              "flex flex-wrap gap-4 sm:gap-6 justify-center mb-8 text-sm sm:text-base",
              isRTL && "rtl-text"
            )}>
              <div className={cn("flex items-center gap-2 glass-effect px-3 py-2 rounded-full border border-white/10", isRTL && "flex-row-reverse")}>
                <span className="text-green-400">✓</span>
                <span>{t('homepage.finalCtaBenefit1')}</span>
              </div>
              <div className={cn("flex items-center gap-2 glass-effect px-3 py-2 rounded-full border border-white/10", isRTL && "flex-row-reverse")}>
                <span className="text-green-400">✓</span>
                <span>{t('homepage.finalCtaBenefit2')}</span>
              </div>
              <div className={cn("flex items-center gap-2 glass-effect px-3 py-2 rounded-full border border-white/10", isRTL && "flex-row-reverse")}>
                <span className="text-green-400">✓</span>
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
                className="mobile-button-primary bg-gradient-to-r from-warm-gold to-warm-gold/90 hover:from-warm-gold/90 hover:to-warm-gold/80 text-white px-6 sm:px-8 py-4 sm:py-6 font-bold text-base sm:text-lg shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 animate-bounce-in"
              >
                <Link to={user ? "/prompts" : "/pricing"} className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                  <Sparkles className="h-5 w-5" />
                  {user ? t('homepage.finalCtaButtonUser') : t('homepage.finalCtaButton')}
                  <ArrowRight className={cn("h-5 w-5", isRTL && "rotate-180")} />
                </Link>
              </Button>
              
              {!user && (
                <p className={cn("text-warm-gold/90 text-sm font-medium animate-pulse-gentle", isRTL && "rtl-text")}>
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
