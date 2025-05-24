
import React from 'react';
import { PricingComparison } from '@/components/pricing/PricingComparison';
import { PricingSection } from '@/components/pricing/PricingSection';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Container } from '@/components/ui/container';
import { Check } from 'lucide-react';

export default function PricingPage() {
  const { user } = useAuth();
  
  const keyFeatures = [
    "Access to premium AI prompts collection",
    "One-time payment, no recurring fees",
    "Regular content updates during access period",
    "Access to exclusive templates",
  ];
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <Container className="py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-dark-base mb-4">
            Choose Your Access Plan
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Get access to our premium collection of AI prompts with a simple one-time payment.
            No subscriptions, no recurring fees.
          </p>
          
          {/* Key Features */}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 mt-6">
            {keyFeatures.map((feature, index) => (
              <div key={index} className="flex items-center">
                <Check className="h-5 w-5 text-warm-gold mr-2 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing cards */}
        <PricingSection />

        {/* Pricing comparison table */}
        <div className="mt-24">
          <h2 className="text-3xl font-bold text-center mb-8">Plan Comparison</h2>
          <PricingComparison />
        </div>

        {/* CTA Section */}
        <div className="mt-24 text-center bg-warm-gold/10 rounded-lg p-8 border border-warm-gold/20">
          <h3 className="text-2xl font-bold mb-4">Ready to access premium AI prompts?</h3>
          <p className="text-lg mb-6 text-muted-foreground">
            Join thousands of users who are creating amazing content with our premium prompts.
          </p>
          <Button 
            size="lg" 
            className="bg-warm-gold hover:bg-warm-gold/90 text-white"
            asChild
          >
            <a href="/checkout">
              Get Access Today
            </a>
          </Button>
        </div>

        {/* FAQ Section */}
        <div className="mt-24 mb-12">
          <h2 className="text-3xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-xl font-medium mb-2">Is this a recurring subscription?</h3>
              <p className="text-muted-foreground">
                No. All our plans are one-time payments. You pay once and get access for the specified duration (1 year for Basic/Standard, lifetime for Premium).
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-xl font-medium mb-2">Can I upgrade my plan later?</h3>
              <p className="text-muted-foreground">
                Yes! You can upgrade to a higher tier plan at any time. You'll only pay the difference between your current plan and the new one.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-xl font-medium mb-2">What happens when my access expires?</h3>
              <p className="text-muted-foreground">
                For Basic and Standard plans, your access will expire after 1 year. You can purchase a new plan to regain access. Premium plans offer lifetime access.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-xl font-medium mb-2">What payment methods do you accept?</h3>
              <p className="text-muted-foreground">
                We accept payments via PayPal and Tap Payment (for local KWD payments).
              </p>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
