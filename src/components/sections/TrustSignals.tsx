import React from 'react';
import { Shield, Clock, Sparkles, Award, RefreshCw, Zap } from 'lucide-react';
import { Container } from '@/components/ui/container';

const trustFeatures = [
  {
    icon: Clock,
    title: "Instant Access",
    description: "Download your prompts immediately after purchase.",
    highlight: "No Waiting"
  },
  {
    icon: RefreshCw,
    title: "Lifetime Updates",
    description: "Get new prompts and updates added to your collection.",
    highlight: "Always Fresh"
  },
  {
    icon: Award,
    title: "Premium Quality",
    description: "Hand-crafted by AI experts and content professionals.",
    highlight: "Expert-Made"
  },
  {
    icon: Sparkles,
    title: "Proven Results",
    description: "Used by creators worldwide to improve their AI outputs.",
    highlight: "Battle-Tested"
  },
  {
    icon: Zap,
    title: "One-Time Payment",
    description: "No recurring fees, subscriptions, or hidden costs.",
    highlight: "No Surprises"
  }
];

const securityBadges = [
  {
    name: "SSL Secured",
    description: "256-bit encryption",
    icon: "🔒"
  },
  {
    name: "Secure Payments",
    description: "PayPal protected",
    icon: "💳"
  },
  {
    name: "Privacy Protected",
    description: "GDPR compliant",
    icon: "🛡️"
  },
  {
    name: "Trusted Quality",
    description: "Expert verified",
    icon: "✅"
  }
];

export function TrustSignals() {
  return (
    <section className="mobile-section-padding bg-gradient-to-br from-white via-warm-gold/5 to-muted-teal/5">
      <Container>
        {/* Header */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="section-title animate-fade-in">
            Why Choose
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-warm-gold to-muted-teal block sm:inline sm:ml-3">
              JojoPrompts?
            </span>
          </h2>
          <p className="section-subtitle animate-fade-in delay-200">
            Your success is our priority. Here's why thousands trust us.
          </p>
        </div>

        {/* Trust Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-12 sm:mb-16">
          {trustFeatures.map((feature, index) => (
            <div 
              key={index}
              className="group bg-white rounded-xl p-6 shadow-md hover:shadow-xl border border-gray-200 hover:border-warm-gold/30 transition-all duration-300 transform hover:-translate-y-1 animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-warm-gold/10 to-muted-teal/10 rounded-lg flex items-center justify-center group-hover:from-warm-gold/20 group-hover:to-muted-teal/20 transition-all duration-300">
                    <feature.icon className="h-6 w-6 text-warm-gold" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-dark-base group-hover:text-warm-gold transition-colors">
                      {feature.title}
                    </h3>
                    <span className="px-2 py-1 bg-warm-gold/10 text-warm-gold text-xs font-medium rounded-full">
                      {feature.highlight}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Security Badges */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-lg border border-gray-200">
          <div className="text-center mb-6">
            <h3 className="text-xl sm:text-2xl font-bold text-dark-base mb-2">Secure & Trusted</h3>
            <p className="text-muted-foreground">Your data and payments are protected with enterprise-grade security</p>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            {securityBadges.map((badge, index) => (
              <div 
                key={index}
                className="flex flex-col items-center p-4 rounded-lg bg-gradient-to-br from-warm-gold/5 to-muted-teal/5 hover:from-warm-gold/10 hover:to-muted-teal/10 transition-all duration-300 group"
              >
                <div className="text-2xl mb-2 group-hover:scale-110 transition-transform duration-300">
                  {badge.icon}
                </div>
                <h4 className="font-semibold text-dark-base text-sm text-center mb-1">
                  {badge.name}
                </h4>
                <p className="text-xs text-muted-foreground text-center">
                  {badge.description}
                </p>
              </div>
            ))}
          </div>
        </div>

      </Container>
    </section>
  );
}