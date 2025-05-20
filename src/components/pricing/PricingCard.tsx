
import React from 'react';
import { Check, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

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
  return (
    <div className={`pricing-card flex flex-col h-full ${
      plan.isPopular ? 'pricing-card-popular transform md:scale-105 md:-translate-y-2' : ''
    }`}>
      {plan.isPopular && (
        <div className="bg-warm-gold text-white text-center py-1.5 text-sm font-medium">
          MOST POPULAR
        </div>
      )}
      
      <div className="p-6 border-b border-border">
        <h3 className="text-xl font-bold text-dark-base">{plan.name}</h3>
        <div className="mt-4 flex items-baseline">
          <span className="text-3xl md:text-4xl font-extrabold text-warm-gold">{plan.price}</span>
          <span className="ml-2 text-sm text-muted-foreground">({plan.localPrice})</span>
        </div>
        <p className="mt-2 text-muted-foreground">{plan.description}</p>
      </div>
      
      <div className="p-6 flex-grow">
        <ul className="space-y-3">
          {plan.features.map((feature, index) => (
            <li key={`feature-${index}`} className="flex items-start">
              <Check className="h-5 w-5 text-warm-gold mr-2 mt-0.5 flex-shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
          
          {plan.excludedFeatures.map((feature, index) => (
            <li key={`excluded-${index}`} className="flex items-start text-muted-foreground">
              <X className="h-5 w-5 text-muted-foreground/50 mr-2 mt-0.5 flex-shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>
      
      <div className="p-6 mt-auto">
        <Button 
          asChild
          className={`w-full ${
            plan.isPopular 
              ? 'bg-warm-gold hover:bg-warm-gold/90' 
              : 'bg-dark-base hover:bg-dark-base/90'
          }`}
        >
          <Link to={isLoggedIn ? "/checkout" : "/login?redirect=checkout"}>
            {plan.ctaText}
          </Link>
        </Button>
      </div>
    </div>
  );
}
