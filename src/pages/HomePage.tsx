
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";
import { PricingSection } from "@/components/pricing/PricingSection";
import { HeroSectionV2 } from "@/components/sections/HeroSectionV2";
import { FeatureHighlights } from "@/components/sections/FeatureHighlights";
import { InteractiveDemo } from "@/components/sections/InteractiveDemo";
import { CategoryShowcase } from "@/components/sections/CategoryShowcase";
import { TrustSignals } from "@/components/sections/TrustSignals";
import { SectionDivider } from "@/components/ui/section-divider";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
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
    <main className="min-h-screen overflow-hidden">
      {/* Hero Section - Dark */}
      <HeroSectionV2 />

      {/* Divider: Dark to Light */}
      <SectionDivider 
        variant="wave" 
        colorFrom="#262626" 
        colorTo="#efeee9" 
        height="md"
      />

      {/* Feature Highlights - Light Background */}
      <section className="bg-soft-bg">
        <ScrollReveal direction="up" duration={800}>
          <FeatureHighlights />
        </ScrollReveal>
      </section>

      {/* Divider: Light to Gradient */}
      <SectionDivider 
        variant="curve" 
        colorFrom="#efeee9" 
        colorTo="#262626" 
        height="md"
      />
      
      {/* Interactive Demo - Dark Background */}
      <section className="bg-dark-base">
        <ScrollReveal direction="up" duration={800} delay={100}>
          <InteractiveDemo />
        </ScrollReveal>
      </section>

      {/* Divider: Dark to Light */}
      <SectionDivider 
        variant="wave-reverse" 
        colorFrom="#262626" 
        colorTo="#efeee9" 
        height="md"
      />
      
      {/* Category Showcase - Light Background */}
      <section className="bg-soft-bg">
        <ScrollReveal direction="up" duration={800}>
          <CategoryShowcase />
        </ScrollReveal>
      </section>

      {/* Divider: Light to Teal-tinted */}
      <SectionDivider 
        variant="angled" 
        colorFrom="#efeee9" 
        colorTo="#f5f7f7" 
        height="sm"
      />
      
      {/* Trust Signals - Light with subtle tint */}
      <section className="bg-gradient-to-b from-[#f5f7f7] to-soft-bg">
        <ScrollReveal direction="scale" duration={600}>
          <TrustSignals />
        </ScrollReveal>
      </section>
      
      {/* Pricing Preview (only shown if user is not logged in) */}
      {!user && (
        <>
          <SectionDivider 
            variant="wave" 
            colorFrom="#efeee9" 
            colorTo="#faf9f7" 
            height="sm"
          />
          <section id="pricing" className="py-16 sm:py-20 md:py-24 bg-gradient-to-b from-[#faf9f7] to-soft-bg">
            <Container>
              <ScrollReveal direction="up" duration={700}>
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
              </ScrollReveal>
              <ScrollReveal direction="up" duration={800} delay={200}>
                <PricingSection />
              </ScrollReveal>
            </Container>
          </section>
        </>
      )}

      {/* Divider: Light to Dark CTA */}
      <SectionDivider 
        variant="curve" 
        colorFrom={user ? "#efeee9" : "#efeee9"} 
        colorTo="#262626" 
        height="md"
      />

      {/* Final Call To Action - Dark */}
      <section className="py-16 sm:py-20 md:py-24 bg-gradient-to-br from-dark-base via-dark-base/95 to-dark-base text-white relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-10 left-10 w-48 h-48 sm:w-64 sm:h-64 bg-warm-gold/10 rounded-full blur-[100px] animate-pulse-gentle" />
          <div className="absolute bottom-10 right-10 w-56 h-56 sm:w-80 sm:h-80 bg-muted-teal/10 rounded-full blur-[120px] animate-pulse-gentle" style={{ animationDelay: '1.5s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-warm-gold/5 rounded-full blur-[80px]" />
        </div>
        
        <Container className="text-center mobile-container-padding relative z-10">
          <ScrollReveal direction="up" duration={800}>
            <div className="max-w-4xl mx-auto">
              <h2 className={cn(
                "text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 mobile-text-center",
                isRTL && "rtl-text"
              )}>
                {t('homepage.finalCtaTitle')}
                <span className={cn(
                  "text-transparent bg-clip-text bg-gradient-to-r from-warm-gold to-muted-teal block sm:inline animate-gradient-text",
                  isRTL ? "sm:mr-3" : "sm:ml-3"
                )}>
                  {t('homepage.finalCtaTitleHighlight')}
                </span>
              </h2>
              <p className={cn(
                "text-base sm:text-lg lg:text-xl mb-6 sm:mb-8 max-w-3xl mx-auto text-white/80 mobile-text-center",
                isRTL && "rtl-text"
              )}>
                {t('homepage.finalCtaSubtitle')}{' '}
                <span className="text-warm-gold font-semibold">{t('homepage.finalCtaHighlight')}</span>
              </p>
              
              {/* Benefits row */}
              <div className={cn(
                "flex flex-wrap gap-3 sm:gap-4 justify-center mb-8 text-sm sm:text-base",
                isRTL && "rtl-text"
              )}>
                {[
                  t('homepage.finalCtaBenefit1'),
                  t('homepage.finalCtaBenefit2'),
                  t('homepage.finalCtaBenefit3'),
                ].map((benefit, index) => (
                  <div 
                    key={index}
                    className={cn(
                      "flex items-center gap-2 bg-white/5 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10",
                      isRTL && "flex-row-reverse"
                    )}
                  >
                    <span className="text-warm-gold">✓</span>
                    <span className="text-white/90">{benefit}</span>
                  </div>
                ))}
              </div>
              
              <div className={cn(
                "flex flex-col sm:flex-row gap-4 justify-center items-center",
                isRTL && "sm:flex-row-reverse"
              )}>
                <Button 
                  asChild 
                  size={isMobile ? "default" : "lg"}
                  className="w-full sm:w-auto bg-gradient-to-r from-warm-gold to-warm-gold/90 hover:from-warm-gold/90 hover:to-warm-gold/80 text-white px-8 py-6 font-bold text-lg shadow-xl shadow-warm-gold/20 hover:shadow-2xl hover:shadow-warm-gold/30 transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 rounded-xl"
                >
                  <Link to={user ? "/prompts" : "/pricing"} className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                    <Sparkles className="h-5 w-5" />
                    {user ? t('homepage.finalCtaButtonUser') : t('homepage.finalCtaButton')}
                    <ArrowRight className={cn("h-5 w-5", isRTL && "rotate-180")} />
                  </Link>
                </Button>
                
                {!user && (
                  <p className={cn("text-warm-gold/80 text-sm font-medium", isRTL && "rtl-text")}>
                    <span className="animate-pulse-gentle inline-block">🚀</span>
                    {' '}{t('homepage.finalCtaMessage')}
                  </p>
                )}
              </div>
            </div>
          </ScrollReveal>
        </Container>
      </section>
    </main>
  );
}
