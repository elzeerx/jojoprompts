import React from 'react';
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, Shield, Zap, Star } from "lucide-react";
import { Container } from "@/components/ui/container";
import { AnimatedButton } from "@/components/ui/animated-button";
import { GlassCard } from "@/components/ui/glass-card";
import { FloatingElement, FloatingShape, FloatingCard } from "@/components/ui/floating-element";
import { useScrollAnimation, useParallax } from "@/hooks/useScrollAnimation";
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

export function HeroSectionV2() {
  const { t, isRTL } = useTranslation();
  const { user } = useAuth();
  const { ref: contentRef, isVisible } = useScrollAnimation({ threshold: 0.1 });
  const { ref: parallaxRef, style: parallaxStyle } = useParallax({ speed: 0.3 });

  return (
    <section className="relative min-h-[100svh] flex items-center overflow-hidden bg-gradient-to-br from-dark-base via-dark-base/95 to-dark-base">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden" ref={parallaxRef} style={parallaxStyle}>
        {/* Gradient orbs */}
        <div className="absolute top-1/4 -left-20 w-[300px] h-[300px] sm:w-[500px] sm:h-[500px] bg-warm-gold/20 rounded-full blur-[100px] animate-pulse-gentle" />
        <div className="absolute bottom-1/4 -right-20 w-[250px] h-[250px] sm:w-[400px] sm:h-[400px] bg-muted-teal/20 rounded-full blur-[80px] animate-pulse-gentle" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] sm:w-[300px] sm:h-[300px] bg-warm-gold/10 rounded-full blur-[60px]" />
        
        {/* Grid pattern overlay */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      {/* Floating Elements - Hidden on very small screens */}
      <div className="absolute inset-0 pointer-events-none hidden sm:block">
        {/* Floating prompt cards */}
        <FloatingCard
          title="Portrait Prompt"
          preview="Cinematic portrait, golden hour lighting..."
          animation="float-slow"
          delay={0}
          className="top-[15%] left-[5%] sm:left-[10%] opacity-80"
          zIndex={10}
        />
        <FloatingCard
          title="Arabic Calligraphy"
          preview="خط عربي جميل بأسلوب حديث..."
          animation="float-delayed"
          delay={1}
          className="top-[25%] right-[5%] sm:right-[8%] opacity-70"
          zIndex={10}
        />
        <FloatingCard
          title="Landscape Scene"
          preview="Ethereal mountain landscape at sunset..."
          animation="float-rotate"
          delay={2}
          className="bottom-[20%] left-[8%] opacity-60 hidden md:block"
          zIndex={10}
        />

        {/* Floating shapes */}
        <FloatingShape shape="circle" size="lg" color="gold" opacity={0.15} blur animation="float-slow" className="top-[10%] right-[20%]" delay={0.5} />
        <FloatingShape shape="ring" size="xl" color="teal" opacity={0.1} animation="float-delayed" className="bottom-[30%] right-[15%]" delay={1.5} />
        <FloatingShape shape="dot" size="sm" color="white" opacity={0.4} animation="float-rotate" className="top-[40%] left-[20%]" delay={0.3} />
        <FloatingShape shape="dot" size="sm" color="gold" opacity={0.5} animation="float-slow" className="top-[60%] right-[30%]" delay={1} />
        <FloatingShape shape="blob" size="lg" color="teal" opacity={0.1} blur animation="float-delayed" className="bottom-[15%] left-[30%] hidden lg:block" delay={2} />
      </div>

      {/* Main Content */}
      <Container className="relative z-20 py-16 sm:py-20 md:py-24">
        <div 
          ref={contentRef}
          className={cn(
            "max-w-4xl mx-auto text-center transition-all duration-1000",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}
        >
          {/* Badge */}
          <div className={cn(
            "inline-flex items-center gap-2 mb-6 sm:mb-8 animate-fade-up",
            isRTL && "flex-row-reverse"
          )}>
            <GlassCard variant="glass" padding="none" className="px-4 py-2 rounded-full">
              <div className={cn("flex items-center gap-2 text-sm text-white/90", isRTL && "flex-row-reverse")}>
                <Sparkles className="h-4 w-4 text-warm-gold" />
                <span>Premium AI Prompts Collection</span>
              </div>
            </GlassCard>
          </div>

          {/* Main Headline with Text Reveal Animation */}
          <h1 className="mb-6 sm:mb-8">
            <span 
              className={cn(
                "block text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white leading-[1.1] mb-2 sm:mb-4 animate-fade-up stagger-1",
                isRTL && "rtl-text"
              )}
            >
              Discover Unique
            </span>
            <span 
              className={cn(
                "block text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold leading-[1.1] animate-fade-up stagger-2",
                "text-transparent bg-clip-text bg-gradient-to-r from-warm-gold via-warm-gold to-muted-teal",
                "animate-gradient-text",
                isRTL && "rtl-text"
              )}
            >
              AI Prompts
            </span>
          </h1>

          {/* Subtitle */}
          <p 
            className={cn(
              "text-base sm:text-lg md:text-xl text-white/70 max-w-2xl mx-auto mb-8 sm:mb-10 animate-fade-up stagger-3 leading-relaxed",
              isRTL && "rtl-text"
            )}
          >
            Hand-picked, customizable prompts for stunning AI-generated images. No subscription, pay once and enjoy forever.
          </p>

          {/* Trust Badges */}
          <div className={cn(
            "flex flex-wrap justify-center gap-3 sm:gap-4 mb-8 sm:mb-10 animate-fade-up stagger-4",
            isRTL && "flex-row-reverse"
          )}>
            {[
              { icon: Shield, text: 'One-time Payment' },
              { icon: Star, text: 'Hand-picked Quality' },
              { icon: Zap, text: 'Arabic Prompts' },
            ].map((badge, index) => (
              <GlassCard 
                key={index}
                variant="glass" 
                padding="none" 
                className="px-3 sm:px-4 py-2 rounded-full"
              >
                <div className={cn("flex items-center gap-2 text-xs sm:text-sm text-white/80", isRTL && "flex-row-reverse")}>
                  <badge.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-warm-gold" />
                  <span>{badge.text}</span>
                </div>
              </GlassCard>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className={cn(
            "flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 animate-fade-up stagger-5",
            isRTL && "sm:flex-row-reverse"
          )}>
            <AnimatedButton 
              variant="gradient" 
              size="lg" 
              glow
              asChild
              className="w-full sm:w-auto"
            >
              <a href="#pricing" className={cn("flex items-center justify-center gap-2", isRTL && "flex-row-reverse")}>
                <Sparkles className="h-5 w-5" />
                <span>Choose Your Plan</span>
              </a>
            </AnimatedButton>
            
            <AnimatedButton 
              variant="glass" 
              size="lg"
              asChild
              className="w-full sm:w-auto"
            >
              <Link to="/prompts" className={cn("flex items-center justify-center gap-2", isRTL && "flex-row-reverse")}>
                <span>Browse Free Examples</span>
                <ArrowRight className={cn("h-5 w-5", isRTL && "rotate-180")} />
              </Link>
            </AnimatedButton>
          </div>

          {/* Urgency Text */}
          <p className={cn(
            "mt-6 sm:mt-8 text-sm text-warm-gold/80 animate-fade-up stagger-6",
            isRTL && "rtl-text"
          )}>
            <span className="animate-pulse-gentle inline-block">🔥</span>
            {' '}Join 500+ creators using our prompts
          </p>
        </div>
      </Container>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 hidden sm:block">
        <div className="flex flex-col items-center gap-2 text-white/40">
          <span className="text-xs uppercase tracking-widest">Scroll</span>
          <div className="w-6 h-10 rounded-full border-2 border-white/20 flex justify-center pt-2">
            <div className="w-1.5 h-3 bg-white/40 rounded-full animate-bounce-subtle" />
          </div>
        </div>
      </div>
    </section>
  );
}
