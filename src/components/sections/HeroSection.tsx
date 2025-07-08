
import React from 'react';
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { ArrowRight } from "lucide-react";

export function HeroSection() {
  return (
    <section 
      className="pt-16 pb-12 sm:pt-20 sm:pb-16 md:pt-24 md:pb-20 relative overflow-hidden bg-cover bg-center min-h-[85vh] sm:min-h-[90vh] flex items-center"
      style={{
        backgroundImage: "url('/lovable-uploads/aa68f984-e890-4e40-938e-913cd0114679.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Dark overlay for better text readability */}
      <div className="absolute inset-0 bg-dark-base/50"></div>
      
      <Container className="relative z-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          <div className="lg:col-span-7 text-center lg:text-left">
            <h1 className="font-bold tracking-tight text-white mb-6 leading-tight">
              <span className="block text-3xl sm:text-4xl md:text-5xl lg:text-6xl">
                Discover Unique{' '}
                <span className="text-warm-gold block sm:inline">AI Prompts</span>
              </span>
            </h1>
            
            <div className="space-y-3 sm:space-y-4 mb-8 text-base sm:text-lg text-white/90">
              <p className="flex items-center gap-3 justify-center lg:justify-start">
                <span className="h-1.5 w-1.5 rounded-full bg-warm-gold flex-shrink-0"></span>
                <span>No recurring subscription, pay once and enjoy forever.</span>
              </p>
              <p className="flex items-center gap-3 justify-center lg:justify-start">
                <span className="h-1.5 w-1.5 rounded-full bg-warm-gold flex-shrink-0"></span>
                <span>All prompts are hand-picked and very customizable to fit your needs.</span>
              </p>
              <p className="flex items-center gap-3 justify-center lg:justify-start">
                <span className="h-1.5 w-1.5 rounded-full bg-warm-gold flex-shrink-0"></span>
                <span>Special Arabic-crafted prompts.</span>
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start">
              <Button 
                asChild 
                size="lg" 
                className="mobile-button-primary order-1 text-base sm:text-lg px-6 sm:px-8 py-4 sm:py-6"
              >
                <a href="#pricing">Choose Your Plan</a>
              </Button>
              <Button 
                asChild 
                variant="outline" 
                size="lg" 
                className="order-2 border-warm-gold/30 bg-dark-base/50 hover:bg-dark-base/70 text-white px-6 sm:px-8 py-4 sm:py-6 font-semibold text-base sm:text-lg rounded-md min-h-[44px] touch-manipulation"
              >
                <Link to="/prompts">
                  <span className="flex items-center gap-2">
                    Browse Prompts 
                    <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
                  </span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </Container>
      
      {/* Decorative elements */}
      <div className="absolute top-20 left-0 w-32 h-32 sm:w-64 sm:h-64 bg-warm-gold/5 rounded-full -z-10 blur-3xl"></div>
      <div className="absolute bottom-10 right-10 w-48 h-48 sm:w-80 sm:h-80 bg-muted-teal/5 rounded-full -z-10 blur-3xl"></div>
    </section>
  );
}
