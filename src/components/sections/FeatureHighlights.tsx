
import React from 'react';
import { Check, Star, Zap, Book } from 'lucide-react';

export function FeatureHighlights() {
  const features = [
    {
      icon: <Star className="h-8 w-8 text-warm-gold" />,
      title: "Premium Prompts",
      description: "Handcrafted AI prompts that stand out from the crowd, designed for exceptional results"
    },
    {
      icon: <Zap className="h-8 w-8 text-warm-gold" />,
      title: "One-Time Payment",
      description: "No recurring fees or subscriptions. Pay once and get lifetime access to your plan's content"
    },
    {
      icon: <Book className="h-8 w-8 text-warm-gold" />,
      title: "Multilingual Support",
      description: "Specialized prompts crafted for Arabic and English users to get the best results"
    },
    {
      icon: <Check className="h-8 w-8 text-warm-gold" />,
      title: "Customizable Prompts",
      description: "All prompts can be easily adapted to your specific needs and requirements"
    }
  ];

  return (
    <section className="py-16">
      <div className="container">
        <h2 className="section-title text-center">Why Choose JojoPrompts?</h2>
        <p className="section-subtitle text-center">Unlock the potential of AI with our premium prompt collection</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mt-12">
          {features.map((feature, index) => (
            <div key={index} className="p-6 border border-warm-gold/20 rounded-lg bg-white/10 backdrop-blur-sm hover:bg-white/20 hover:shadow-md transition-all">
              <div className="mb-4">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold text-dark-base mb-2">
                {feature.title}
              </h3>
              <p className="text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
