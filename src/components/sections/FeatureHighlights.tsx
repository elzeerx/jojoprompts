
import React from 'react';
import { Check, Star, Zap, Book } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

export function FeatureHighlights() {
  const isMobile = useIsMobile();
  
  const features = [
    {
      icon: <Star className="h-6 w-6 sm:h-8 sm:w-8 text-warm-gold" />,
      title: "Premium Prompts",
      description: "Handcrafted AI prompts that stand out from the crowd, designed for exceptional results"
    },
    {
      icon: <Zap className="h-6 w-6 sm:h-8 sm:w-8 text-warm-gold" />,
      title: "One-Time Payment",
      description: "No recurring fees or subscriptions. Pay once and get lifetime access to your plan's content"
    },
    {
      icon: <Book className="h-6 w-6 sm:h-8 sm:w-8 text-warm-gold" />,
      title: "Multilingual Support",
      description: "Specialized prompts crafted for Arabic and English users to get the best results"
    },
    {
      icon: <Check className="h-6 w-6 sm:h-8 sm:w-8 text-warm-gold" />,
      title: "Customizable Prompts",
      description: "All prompts can be easily adapted to your specific needs and requirements"
    }
  ];

  return (
    <section className="mobile-section-padding overflow-hidden">
      <div className="container">
        <h2 className="section-title text-center mobile-text-center">Why Choose JojoPrompts?</h2>
        <p className="section-subtitle text-center mobile-text-center">Unlock the potential of AI with our premium prompt collection</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 mt-8 sm:mt-12">
          {features.map((feature, index) => (
            <div 
              key={index} 
              className="mobile-card group hover:shadow-lg hover:border-warm-gold/30 transition-all duration-300 touch-manipulation"
            >
              <div className="mb-3 sm:mb-4 flex justify-center lg:justify-start">
                <div className="p-2 sm:p-3 bg-warm-gold/10 rounded-lg group-hover:bg-warm-gold/20 transition-colors duration-300">
                  {feature.icon}
                </div>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-dark-base mb-2 sm:mb-3 text-center lg:text-left">
                {feature.title}
              </h3>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed text-center lg:text-left">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
