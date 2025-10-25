
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";
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

const logger = createLogger('HOME_PAGE');

export default function HomePage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();

  logger.debug('HomePage mounted', { hasUser: !!user, isMobile });

  return (
    <main className="min-h-screen bg-gradient-to-br from-soft-bg via-warm-gold/10 to-muted-teal/20">
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
        <section id="pricing" className="mobile-section-padding bg-white/10 backdrop-blur-sm">
          <Container>
            <div className="text-center mb-8 sm:mb-12 mobile-container-padding">
              <h2 className="section-title mobile-text-center">
                Choose Your
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-warm-gold to-muted-teal block sm:inline sm:ml-3">
                  Success Plan
                </span>
              </h2>
              <p className="section-subtitle mobile-text-center">
                One-time payment, lifetime access. No subscriptions, no recurring fees, no surprises.
              </p>
              
              {/* Urgency indicator */}
              <div className="inline-flex items-center gap-2 bg-warm-gold/10 border border-warm-gold/20 rounded-full px-4 py-2 mt-4">
                <span className="animate-pulse-gentle">🔥</span>
                <span className="text-warm-gold font-medium text-sm">Limited time: Get instant access today</span>
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
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 mobile-text-center animate-fade-in">
              Stop Wasting Time on
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-warm-gold to-muted-teal block sm:inline sm:ml-3">
                Generic Prompts
              </span>
            </h2>
            <p className="text-base sm:text-lg lg:text-xl mb-6 sm:mb-8 max-w-3xl mx-auto opacity-90 mobile-text-center animate-fade-in delay-200">
              Transform your AI results today with professional-grade prompts that actually work. 
              <span className="text-warm-gold font-semibold"> One payment, lifetime access.</span>
            </p>
            
            {/* Benefits row */}
            <div className="flex flex-wrap gap-4 sm:gap-6 justify-center mb-8 text-sm sm:text-base">
              <div className="flex items-center gap-2 glass-effect px-3 py-2 rounded-full border border-white/10">
                <span className="text-green-400">✓</span>
                <span>Instant Download</span>
              </div>
              <div className="flex items-center gap-2 glass-effect px-3 py-2 rounded-full border border-white/10">
                <span className="text-green-400">✓</span>
                <span>30-Day Guarantee</span>
              </div>
              <div className="flex items-center gap-2 glass-effect px-3 py-2 rounded-full border border-white/10">
                <span className="text-green-400">✓</span>
                <span>No Subscriptions</span>
              </div>
            </div>
            
            <div className="space-y-4 sm:space-y-0 sm:space-x-4 sm:flex sm:justify-center sm:items-center">
              <Button 
                asChild 
                size={isMobile ? "default" : "lg"}
                className="mobile-button-primary bg-gradient-to-r from-warm-gold to-warm-gold/90 hover:from-warm-gold/90 hover:to-warm-gold/80 text-white px-6 sm:px-8 py-4 sm:py-6 font-bold text-base sm:text-lg shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 animate-bounce-in"
              >
                <Link to={user ? "/prompts" : "/pricing"} className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  {user ? "Browse Your Prompts" : "Get Instant Access Now"}
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              
              {!user && (
                <p className="text-warm-gold/90 text-sm font-medium animate-pulse-gentle">
                  🚀 Start getting better AI results today
                </p>
              )}
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}
