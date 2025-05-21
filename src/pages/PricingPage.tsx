
import React from 'react';
import { PricingComparison } from '@/components/pricing/PricingComparison';
import { PricingSection } from '@/components/pricing/PricingSection';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

export default function PricingPage() {
  const { user } = useAuth();
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <div className="container max-w-6xl mx-auto py-12 px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-dark-base mb-4">
            Choose Your Perfect Plan
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Access our premium collection of AI prompts with a one-time payment.
            No subscriptions, no recurring fees.
          </p>
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
            <a href={user ? "/checkout" : "/login?redirect=checkout"}>
              Get Started Today
            </a>
          </Button>
        </div>

        {/* FAQ Section */}
        <div className="mt-24 mb-12">
          <h2 className="text-3xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-xl font-medium mb-2">Is this a subscription?</h3>
              <p className="text-muted-foreground">
                No. All our plans are one-time payments. You pay once and get lifetime access to the prompts included in your plan.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-xl font-medium mb-2">Can I upgrade my plan later?</h3>
              <p className="text-muted-foreground">
                Yes! You can upgrade to a higher tier plan at any time. You'll only pay the difference between your current plan and the new one.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-xl font-medium mb-2">Do I get access to future prompts?</h3>
              <p className="text-muted-foreground">
                Yes, depending on your plan, you'll get access to future prompts in the categories included in your plan.
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
      </div>
    </div>
  );
}
