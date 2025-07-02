
import React from 'react';
import { Check, Star, Zap, Book } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

export function FeatureHighlights() {
  const features = [
    {
      icon: <Star className="h-6 w-6 sm:h-8 sm:w-8 text-warm-gold" />,
      title: "10x Better Results",
      description: "Transform generic AI outputs into professional-grade content that actually works for your business",
      metric: "10x",
      metricLabel: "Better Output Quality"
    },
    {
      icon: <Zap className="h-6 w-6 sm:h-8 sm:w-8 text-warm-gold" />,
      title: "Save Hours Daily",
      description: "Stop wasting time tweaking prompts. Our tested formulas work perfectly on the first try",
      metric: "5hrs",
      metricLabel: "Saved Per Day"
    },
    {
      icon: <Book className="h-6 w-6 sm:h-8 sm:w-8 text-warm-gold" />,
      title: "Arabic & English Mastery",
      description: "Culturally-aware prompts that understand context, nuance, and deliver authentic results",
      metric: "2x",
      metricLabel: "Languages Mastered"
    },
    {
      icon: <Check className="h-6 w-6 sm:h-8 sm:w-8 text-warm-gold" />,
      title: "Instant ROI",
      description: "Pay once, use forever. No monthly fees eating into your profits like other AI tools",
      metric: "$0",
      metricLabel: "Monthly Fees"
    }
  ];

  return (
    <section className="mobile-section-padding overflow-hidden bg-gradient-to-br from-white via-warm-gold/5 to-muted-teal/5">
      <div className="container">
        <h2 className="section-title text-center mobile-text-center animate-fade-in">
          Stop Struggling with
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-warm-gold to-muted-teal block sm:inline sm:ml-3">
            Generic Prompts
          </span>
        </h2>
        <p className="section-subtitle text-center mobile-text-center animate-fade-in delay-200">
          Get professional results immediately with our battle-tested prompt collection
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 mt-8 sm:mt-12">
          {features.map((feature, index) => (
            <div 
              key={index} 
              className="group bg-white rounded-xl p-6 shadow-md hover:shadow-xl border border-gray-200 hover:border-warm-gold/30 transition-all duration-300 transform hover:-translate-y-2 animate-fade-in"
              style={{ animationDelay: `${index * 150}ms` }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-gradient-to-br from-warm-gold/10 to-muted-teal/10 rounded-lg group-hover:from-warm-gold/20 group-hover:to-muted-teal/20 transition-all duration-300">
                  {feature.icon}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-warm-gold group-hover:scale-110 transition-transform">
                    {feature.metric}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {feature.metricLabel}
                  </div>
                </div>
              </div>
              
              <h3 className="text-lg sm:text-xl font-semibold text-dark-base mb-3 group-hover:text-warm-gold transition-colors">
                {feature.title}
              </h3>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
              
              {/* Progress indicator */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className="h-2 bg-gradient-to-r from-warm-gold to-muted-teal rounded-full transform origin-left group-hover:scale-x-100 scale-x-75 transition-transform duration-1000"
                    style={{ transitionDelay: `${index * 200}ms` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Bottom CTA */}
        <div className="text-center mt-12 sm:mt-16 animate-fade-in">
          <p className="text-muted-teal font-medium text-lg mb-4">
            Ready to transform your AI experience?
          </p>
          <div className="inline-flex items-center gap-2 text-warm-gold text-sm font-medium">
            <span>🚀</span>
            <span>Start getting professional results today</span>
          </div>
        </div>
      </div>
    </section>
  );
}
