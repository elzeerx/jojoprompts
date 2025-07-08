
import React from 'react';
import { Check, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useIsMobile } from '@/hooks/use-mobile';

interface PricingPlan {
  id: string;
  name: string;
  price: string;
  localPrice: string;
  description: string;
  features: string[];
  excludedFeatures: string[];
  isPopular: boolean;
  ctaText: string;
}

interface PricingCardProps {
  plan: PricingPlan;
  isLoggedIn?: boolean;
}

export function PricingCard({ plan, isLoggedIn = false }: PricingCardProps) {
  const isMobile = useIsMobile();

  return (
    <div className={`pricing-card flex flex-col h-full mobile-optimize-rendering ${
      plan.isPopular ? 'pricing-card-popular transform md:scale-105 md:-translate-y-2' : ''
    }`}>
      {plan.isPopular && (
        <div className="bg-warm-gold text-white text-center py-2 text-xs sm:text-sm font-medium">
          MOST POPULAR
        </div>
      )}
      
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-border">
        <h3 className="text-lg sm:text-xl font-bold text-dark-base text-center sm:text-left">{plan.name}</h3>
        <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row sm:items-baseline text-center sm:text-left">
          <span className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-warm-gold">{plan.price}</span>
          <span className="ml-0 sm:ml-2 text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-0">({plan.localPrice})</span>
        </div>
        <p className="mt-2 sm:mt-3 text-sm sm:text-base text-muted-foreground text-center sm:text-left leading-relaxed">{plan.description}</p>
      </div>
      
      {/* Features */}
      <div className="p-4 sm:p-6 flex-grow">
        <ul className="space-y-2 sm:space-y-3">
          {plan.features.map((feature, index) => (
            <li key={`feature-${index}`} className="flex items-start">
              <Check className="mobile-icon text-warm-gold mr-2 sm:mr-3 mt-0.5 flex-shrink-0" />
              <span className="text-sm sm:text-base leading-relaxed">{feature}</span>
            </li>
          ))}
          
          {plan.excludedFeatures.map((feature, index) => (
            <li key={`excluded-${index}`} className="flex items-start text-muted-foreground">
              <X className="mobile-icon text-muted-foreground/50 mr-2 sm:mr-3 mt-0.5 flex-shrink-0" />
              <span className="text-sm sm:text-base leading-relaxed">{feature}</span>
            </li>
          ))}
        </ul>
      </div>
      
      {/* CTA Button */}
      <div className="p-4 sm:p-6 mt-auto">
        <Button 
          asChild
          size={isMobile ? "default" : "lg"}
          className={`mobile-button-primary ${
            plan.isPopular 
              ? 'bg-warm-gold hover:bg-warm-gold/90' 
              : 'bg-dark-base hover:bg-dark-base/90'
          }`}
        >
          {/* Always go to checkout regardless of authentication status */}
          <Link to={`/checkout?plan_id=${plan.id}`}>
            {plan.ctaText}
          </Link>
        </Button>
      </div>
    </div>
  );
}
