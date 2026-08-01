import React from 'react';
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { ArrowRight, Sparkles, Zap, Shield, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
export function EnhancedHeroSection() {
  const { user } = useAuth();
  const { t, isRTL } = useTranslation();
  return <section className="pt-16 pb-12 sm:pt-20 sm:pb-16 md:pt-24 md:pb-20 relative overflow-hidden min-h-[85vh] sm:min-h-[90vh] flex items-center bg-cover bg-center" style={{
    backgroundImage: "url('/lovable-uploads/adc48b81-aea8-44bc-a53e-5aa9e7bcb323.png')"
  }}>
      {/* Dark overlay for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-br from-dark-base/60 via-dark-base/40 to-transparent"></div>
      
      <Container className="relative z-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          <div className={cn("lg:col-span-7 text-center", isRTL ? "lg:text-right" : "lg:text-left")}>
            {/* Animated headline */}
            <div className="overflow-hidden mb-6">
              <h1 className={cn("font-bold tracking-tight text-white leading-tight animate-slide-in-up", isRTL && "rtl-text")}>
                <span className="block text-3xl sm:text-4xl md:text-5xl lg:text-6xl">
                  {t('enhancedHero.title')}{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-warm-gold via-warm-gold/90 to-muted-teal animate-gradient-shift block sm:inline">
                    {t('enhancedHero.titleHighlight')}
                  </span>
                </span>
                <span className="block text-xl sm:text-2xl md:text-3xl lg:text-4xl mt-2 text-white/90 animate-fade-in-delayed">
                  {t('enhancedHero.subtitle')}
                </span>
              </h1>
            </div>
            
            {/* Enhanced value proposition */}
            <div className={cn("space-y-3 sm:space-y-4 mb-8 text-base sm:text-lg text-white/90 animate-fade-in-delayed", isRTL && "rtl-text")}>
              <div className={cn(
                "flex items-center gap-3 glass-effect px-4 py-2 rounded-lg border border-white/10",
                isRTL ? "flex-row-reverse justify-center lg:justify-end" : "justify-center lg:justify-start"
              )}>
                <div className="h-2 w-2 rounded-full bg-gradient-to-r from-warm-gold to-muted-teal animate-pulse-gentle flex-shrink-0"></div>
                <span>{t('enhancedHero.benefit1')}</span>
              </div>
              <div className={cn(
                "flex items-center gap-3 glass-effect px-4 py-2 rounded-lg border border-white/10",
                isRTL ? "flex-row-reverse justify-center lg:justify-end" : "justify-center lg:justify-start"
              )}>
                <div className="h-2 w-2 rounded-full bg-gradient-to-r from-warm-gold to-muted-teal animate-pulse-gentle flex-shrink-0" style={{
                animationDelay: '0.3s'
              }}></div>
                <span>{t('enhancedHero.benefit2')}</span>
              </div>
              <div className={cn(
                "flex items-center gap-3 glass-effect px-4 py-2 rounded-lg border border-white/10",
                isRTL ? "flex-row-reverse justify-center lg:justify-end" : "justify-center lg:justify-start"
              )}>
                <div className="h-2 w-2 rounded-full bg-gradient-to-r from-warm-gold to-muted-teal animate-pulse-gentle flex-shrink-0" style={{
                animationDelay: '0.6s'
              }}></div>
                <span>{t('enhancedHero.benefit3')}</span>
              </div>
            </div>

            {/* Trust indicators */}
            <div className={cn(
              "flex flex-wrap gap-4 sm:gap-6 mb-8 text-white/80 text-sm",
              isRTL ? "justify-center lg:justify-end" : "justify-center lg:justify-start"
            )}>
              <div className={cn("flex items-center gap-2 glass-effect px-3 py-1 rounded-full border border-white/10", isRTL && "flex-row-reverse")}>
                <Shield className="h-4 w-4 text-warm-gold" />
                <span>{t('enhancedHero.trustBadge1')}</span>
              </div>
              <div className={cn("flex items-center gap-2 glass-effect px-3 py-1 rounded-full border border-white/10", isRTL && "flex-row-reverse")}>
                <Clock className="h-4 w-4 text-warm-gold" />
                <span>{t('enhancedHero.trustBadge2')}</span>
              </div>
              <div className={cn("flex items-center gap-2 glass-effect px-3 py-1 rounded-full border border-white/10", isRTL && "flex-row-reverse")}>
                <Sparkles className="h-4 w-4 text-warm-gold" />
                <span>{t('enhancedHero.trustBadge3')}</span>
              </div>
            </div>
            
            {/* Enhanced CTAs */}
            <div className={cn(
              "flex flex-col sm:flex-row gap-3 sm:gap-4",
              isRTL ? "justify-center lg:justify-end" : "justify-center lg:justify-start"
            )}>
              <Button asChild size="lg" className="order-1 text-base sm:text-lg px-6 sm:px-8 py-4 sm:py-6 bg-gradient-to-r from-warm-gold to-warm-gold/90 hover:from-warm-gold/90 hover:to-warm-gold/80 text-white font-bold shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 animate-bounce-in border-0">
                <a href="#pricing" className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                  <Zap className="h-5 w-5" />
                  {t('enhancedHero.ctaPrimary')}
                  <ArrowRight className={cn("h-5 w-5", isRTL && "rotate-180")} />
                </a>
              </Button>
              
              <Button asChild variant="outline" size="lg" className="order-2 glass-effect border-warm-gold/30 bg-white/10 hover:bg-white/20 text-white px-6 sm:px-8 py-4 sm:py-6 font-semibold text-base sm:text-lg rounded-lg min-h-[44px] touch-manipulation backdrop-blur-sm transition-all duration-300 hover:border-warm-gold/50">
                <Link to="/explore" className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                  <span>{t('enhancedHero.ctaSecondary')}</span>
                  <ArrowRight className={cn("h-4 w-4 sm:h-5 sm:w-5", isRTL && "rotate-180")} />
                </Link>
              </Button>
            </div>

            {/* Urgency indicator */}
            <div className={cn("mt-6 text-center", isRTL ? "lg:text-right rtl-text" : "lg:text-left")}>
              <p className="text-warm-gold/90 text-sm font-medium animate-pulse-gentle">
                🔥 {t('enhancedHero.urgency')}
              </p>
            </div>
          </div>
          
          {/* Right side - could add floating elements or preview */}
          <div className="lg:col-span-5 relative hidden lg:block">
            <div className="relative">
              {/* Floating elements */}
              <div className="absolute top-10 right-10 w-20 h-20 glass-effect rounded-full border border-warm-gold/20 flex items-center justify-center animate-float">
                <Sparkles className="h-8 w-8 text-warm-gold" />
              </div>
              
            </div>
          </div>
        </div>
      </Container>
    </section>;
}
