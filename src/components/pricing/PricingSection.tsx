
import React from 'react';
import { Check, X } from 'lucide-react';
import { PricingCard } from './PricingCard';
import { useAuth } from "@/contexts/AuthContext";

export function PricingSection() {
  const { user } = useAuth();
  
  const pricingPlans = [
    {
      id: "tier1",
      name: "Basic",
      price: "$55",
      localPrice: "15 KWD",
      description: "1-year access, non-renewal",
      features: [
        "ChatGPT prompts only",
        "Access to all future ChatGPT prompts",
        "Basic email support",
        "1-year access"
      ],
      excludedFeatures: [
        "Midjourney prompts",
        "n8n workflows",
        "Future categories",
        "Special prompt requests",
        "Lifetime access"
      ],
      isPopular: false,
      ctaText: "Get Started"
    },
    {
      id: "tier2",
      name: "Standard",
      price: "$65",
      localPrice: "20 KWD",
      description: "1-year access, non-renewal",
      features: [
        "ChatGPT prompts",
        "Midjourney prompts",
        "Access to all future prompts in these categories",
        "Standard email support",
        "1-year access"
      ],
      excludedFeatures: [
        "n8n workflows",
        "Future categories",
        "Special prompt requests",
        "Lifetime access"
      ],
      isPopular: false,
      ctaText: "Get Started"
    },
    {
      id: "tier3",
      name: "Premium",
      price: "$80",
      localPrice: "25 KWD",
      description: "Lifetime access",
      features: [
        "ChatGPT prompts",
        "Midjourney prompts",
        "n8n workflows",
        "All future categories",
        "Priority email support",
        "Lifetime access",
        "All future updates"
      ],
      excludedFeatures: [
        "Special prompt requests"
      ],
      isPopular: true,
      ctaText: "Best Value"
    },
    {
      id: "tier4",
      name: "Ultimate",
      price: "$100",
      localPrice: "30 KWD",
      description: "Lifetime access + Custom Requests",
      features: [
        "ChatGPT prompts",
        "Midjourney prompts",
        "n8n workflows",
        "All future categories",
        "Priority email support",
        "Lifetime access",
        "All future updates",
        "Up to 20 special prompt requests"
      ],
      excludedFeatures: [],
      isPopular: false,
      ctaText: "Get Everything"
    }
  ];

  return (
    <section id="pricing" className="py-16 bg-white">
      <div className="container">
        <h2 className="section-title text-center">Choose Your Plan</h2>
        <p className="section-subtitle text-center">
          Select the perfect package that suits your needs. Pay once, no recurring fees.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 mt-12">
          {pricingPlans.map((plan) => (
            <PricingCard 
              key={plan.id} 
              plan={plan} 
              isLoggedIn={!!user}
            />
          ))}
        </div>
        
        <div className="mt-12 max-w-2xl mx-auto text-center">
          <p className="text-muted-foreground">
            All plans include a 7-day money-back guarantee. Have questions?{" "}
            <a href="mailto:support@jojoprompts.com" className="text-warm-gold font-medium hover:underline">
              Contact our support team
            </a>.
          </p>
        </div>
      </div>
    </section>
  );
}
