
import React from 'react';
import { PricingComparison } from '@/components/pricing/PricingComparison';
import { PricingSection } from '@/components/pricing/PricingSection';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Container } from '@/components/ui/container';
import { Check } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

export default function PricingPage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  
  const keyFeatures = [
    "Access to premium AI prompts collection",
    "One-time payment, no recurring fees",
    "Regular content updates during access period",
    "Access to exclusive templates",
  ];
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <Container className="mobile-section-padding">
        {/* Hero Section */}
        <div className="text-center mobile-container-padding mb-8 sm:mb-12">
          <h1 className="section-title mobile-text-center mb-4 sm:mb-6">
            Choose Your Access Plan
          </h1>
          <p className="section-subtitle mobile-text-center max-w-3xl mx-auto">
            Get access to our premium collection of AI prompts with a simple one-time payment.
            No subscriptions, no recurring fees.
          </p>
          
          {/* Key Features - Mobile Optimized */}
          <div className="mobile-grid-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6 sm:mt-8 max-w-4xl mx-auto">
            {keyFeatures.map((feature, index) => (
              <div key={index} className="flex items-center justify-center sm:justify-start text-center sm:text-left">
                <Check className="mobile-icon text-warm-gold mr-2 flex-shrink-0" />
                <span className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing cards */}
        <div id="pricing" className="mb-16 sm:mb-24">
          <PricingSection />
        </div>

        {/* Pricing comparison table */}
        <div className="mb-16 sm:mb-24">
          <h2 className="section-title text-center mobile-text-center mb-6 sm:mb-8">Plan Comparison</h2>
          <PricingComparison />
        </div>

        {/* CTA Section */}
        <div className="mobile-container-padding bg-warm-gold/10 rounded-xl sm:rounded-2xl p-6 sm:p-8 border border-warm-gold/20 mb-16 sm:mb-24">
          <div className="text-center">
            <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-dark-base">Ready to access premium AI prompts?</h3>
            <p className="text-sm sm:text-lg mb-4 sm:mb-6 text-muted-foreground max-w-2xl mx-auto">
              Join thousands of users who are creating amazing content with our premium prompts.
            </p>
            <Button 
              size={isMobile ? "default" : "lg"}
              className="mobile-button-primary bg-warm-gold hover:bg-warm-gold/90 text-white"
              asChild
            >
              <a href="#pricing" onClick={(e) => {
                e.preventDefault();
                document.querySelector('#pricing')?.scrollIntoView({ behavior: 'smooth' });
              }}>
                Get Access Today
              </a>
            </Button>
          </div>
        </div>

        {/* FAQ Section - Mobile Optimized */}
        <div className="mobile-container-padding">
          <h2 className="section-title text-center mobile-text-center mb-6 sm:mb-8">Frequently Asked Questions</h2>
          <div className="mobile-grid-2 gap-4 sm:gap-6 lg:gap-8">
            <div className="mobile-card">
              <h3 className="text-lg sm:text-xl font-medium mb-2 sm:mb-3 text-dark-base">Is this a recurring subscription?</h3>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                No. All our plans are one-time payments. You pay once and get access for the specified duration (1 year for Basic/Standard, lifetime for Premium).
              </p>
            </div>
            <div className="mobile-card">
              <h3 className="text-lg sm:text-xl font-medium mb-2 sm:mb-3 text-dark-base">Can I upgrade my plan later?</h3>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Yes! You can upgrade to a higher tier plan at any time. You'll only pay the difference between your current plan and the new one.
              </p>
            </div>
            <div className="mobile-card">
              <h3 className="text-lg sm:text-xl font-medium mb-2 sm:mb-3 text-dark-base">What happens when my access expires?</h3>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                For Basic and Standard plans, your access will expire after 1 year. You can purchase a new plan to regain access. Premium plans offer lifetime access.
              </p>
            </div>
            <div className="mobile-card">
              <h3 className="text-lg sm:text-xl font-medium mb-2 sm:mb-3 text-dark-base">What payment methods do you accept?</h3>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                We accept payments via <strong>PayPal</strong>.
              </p>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
