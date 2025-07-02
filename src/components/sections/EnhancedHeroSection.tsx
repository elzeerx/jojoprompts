import React from 'react';
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { ArrowRight, Sparkles, Zap, Shield, Clock } from "lucide-react";
import { AnimatedBackground } from "./AnimatedBackground";
import { useAuth } from "@/contexts/AuthContext";

export function EnhancedHeroSection() {
  const { user } = useAuth();

  return (
    <section className="pt-16 pb-12 sm:pt-20 sm:pb-16 md:pt-24 md:pb-20 relative overflow-hidden min-h-[85vh] sm:min-h-[90vh] flex items-center">
      {/* Animated Background */}
      <AnimatedBackground />
      
      {/* Dark overlay for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-br from-dark-base/60 via-dark-base/40 to-transparent"></div>
      
      <Container className="relative z-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          <div className="lg:col-span-7 text-center lg:text-left">
            {/* Animated headline */}
            <div className="overflow-hidden mb-6">
              <h1 className="font-bold tracking-tight text-white leading-tight animate-slide-in-up">
                <span className="block text-3xl sm:text-4xl md:text-5xl lg:text-6xl">
                  Transform Your{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-warm-gold via-warm-gold/90 to-muted-teal animate-gradient-shift block sm:inline">
                    AI Results
                  </span>
                </span>
                <span className="block text-xl sm:text-2xl md:text-3xl lg:text-4xl mt-2 text-white/90 animate-fade-in-delayed">
                  in Minutes, Not Hours
                </span>
              </h1>
            </div>
            
            {/* Enhanced value proposition */}
            <div className="space-y-3 sm:space-y-4 mb-8 text-base sm:text-lg text-white/90 animate-fade-in-delayed">
              <p className="flex items-center gap-3 justify-center lg:justify-start glass-effect px-4 py-2 rounded-lg border border-white/10">
                <div className="h-2 w-2 rounded-full bg-gradient-to-r from-warm-gold to-muted-teal animate-pulse-gentle flex-shrink-0"></div>
                <span>Stop wasting time on generic prompts that don't work</span>
              </p>
              <p className="flex items-center gap-3 justify-center lg:justify-start glass-effect px-4 py-2 rounded-lg border border-white/10">
                <div className="h-2 w-2 rounded-full bg-gradient-to-r from-warm-gold to-muted-teal animate-pulse-gentle flex-shrink-0" style={{ animationDelay: '0.3s' }}></div>
                <span>Get 10x better AI outputs with our hand-crafted prompts</span>
              </p>
              <p className="flex items-center gap-3 justify-center lg:justify-start glass-effect px-4 py-2 rounded-lg border border-white/10">
                <div className="h-2 w-2 rounded-full bg-gradient-to-r from-warm-gold to-muted-teal animate-pulse-gentle flex-shrink-0" style={{ animationDelay: '0.6s' }}></div>
                <span>One-time payment, lifetime access - no subscriptions ever</span>
              </p>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap gap-4 sm:gap-6 justify-center lg:justify-start mb-8 text-white/80 text-sm">
              <div className="flex items-center gap-2 glass-effect px-3 py-1 rounded-full border border-white/10">
                <Shield className="h-4 w-4 text-warm-gold" />
                <span>30-Day Guarantee</span>
              </div>
              <div className="flex items-center gap-2 glass-effect px-3 py-1 rounded-full border border-white/10">
                <Clock className="h-4 w-4 text-warm-gold" />
                <span>Instant Access</span>
              </div>
              <div className="flex items-center gap-2 glass-effect px-3 py-1 rounded-full border border-white/10">
                <Sparkles className="h-4 w-4 text-warm-gold" />
                <span>Arabic & English</span>
              </div>
            </div>
            
            {/* Enhanced CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start">
              <Button 
                asChild 
                size="lg" 
                className="order-1 text-base sm:text-lg px-6 sm:px-8 py-4 sm:py-6 bg-gradient-to-r from-warm-gold to-warm-gold/90 hover:from-warm-gold/90 hover:to-warm-gold/80 text-white font-bold shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 animate-bounce-in border-0"
              >
                <a href="#pricing" className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Unlock Premium Prompts Now
                  <ArrowRight className="h-5 w-5" />
                </a>
              </Button>
              
              <Button 
                asChild 
                variant="outline" 
                size="lg" 
                className="order-2 glass-effect border-warm-gold/30 bg-white/10 hover:bg-white/20 text-white px-6 sm:px-8 py-4 sm:py-6 font-semibold text-base sm:text-lg rounded-lg min-h-[44px] touch-manipulation backdrop-blur-sm transition-all duration-300 hover:border-warm-gold/50"
              >
                <Link to="/prompts" className="flex items-center gap-2">
                  <span>See Examples</span>
                  <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
                </Link>
              </Button>
            </div>

            {/* Urgency indicator */}
            <div className="mt-6 text-center lg:text-left">
              <p className="text-warm-gold/90 text-sm font-medium animate-pulse-gentle">
                🔥 Join thousands of creators getting better AI results today
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
              <div className="absolute bottom-20 left-10 w-16 h-16 glass-effect rounded-full border border-muted-teal/20 flex items-center justify-center animate-float" style={{ animationDelay: '1s' }}>
                <Zap className="h-6 w-6 text-muted-teal" />
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}