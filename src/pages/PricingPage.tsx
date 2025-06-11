
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Zap, Star } from "lucide-react";
import { Link } from "react-router-dom";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-soft-bg via-warm-gold/10 to-muted-teal/20 mobile-container-padding mobile-section-padding">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="rounded-full bg-warm-gold/10 p-4 border-2 border-warm-gold/20">
              <Crown className="h-12 w-12 text-warm-gold" />
            </div>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 text-dark-base">
            Simple, Transparent Pricing
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Choose the perfect plan for your AI prompt needs. All plans include lifetime access with regular updates.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {/* Starter Plan */}
          <Card className="relative border-2 border-muted-teal/20 bg-muted-teal/5">
            <CardHeader className="text-center pb-8">
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-muted-teal/10 p-3">
                  <Zap className="h-8 w-8 text-muted-teal" />
                </div>
              </div>
              <CardTitle className="text-2xl text-dark-base">Starter</CardTitle>
              <div className="text-3xl font-bold text-dark-base">$29</div>
              <p className="text-muted-foreground">One-time payment</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-muted-teal" />
                  <span>100+ Premium Prompts</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-muted-teal" />
                  <span>ChatGPT & GPT-4 Prompts</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-muted-teal" />
                  <span>Basic Midjourney Prompts</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-muted-teal" />
                  <span>Lifetime Access</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-muted-teal" />
                  <span>Regular Updates</span>
                </div>
              </div>
              <Button className="w-full mt-6 bg-muted-teal hover:bg-muted-teal/90" asChild>
                <Link to="/checkout?plan=starter">
                  Get Started
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Pro Plan */}
          <Card className="relative border-2 border-warm-gold/30 bg-warm-gold/10 transform scale-105">
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <Badge className="bg-warm-gold text-white">Most Popular</Badge>
            </div>
            <CardHeader className="text-center pb-8">
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-warm-gold/20 p-3">
                  <Star className="h-8 w-8 text-warm-gold" />
                </div>
              </div>
              <CardTitle className="text-2xl text-dark-base">Pro</CardTitle>
              <div className="text-3xl font-bold text-dark-base">$49</div>
              <p className="text-muted-foreground">One-time payment</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-warm-gold" />
                  <span>500+ Premium Prompts</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-warm-gold" />
                  <span>All GPT Model Prompts</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-warm-gold" />
                  <span>Advanced Midjourney Prompts</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-warm-gold" />
                  <span>DALL-E & Stable Diffusion</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-warm-gold" />
                  <span>Workflow Templates</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-warm-gold" />
                  <span>Priority Support</span>
                </div>
              </div>
              <Button className="w-full mt-6 bg-warm-gold hover:bg-warm-gold/90" asChild>
                <Link to="/checkout?plan=pro">
                  Get Pro Access
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Premium Plan */}
          <Card className="relative border-2 border-dark-base/20 bg-dark-base/5">
            <CardHeader className="text-center pb-8">
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-dark-base/10 p-3">
                  <Crown className="h-8 w-8 text-dark-base" />
                </div>
              </div>
              <CardTitle className="text-2xl text-dark-base">Premium</CardTitle>
              <div className="text-3xl font-bold text-dark-base">$99</div>
              <p className="text-muted-foreground">One-time payment</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-dark-base" />
                  <span>1000+ Premium Prompts</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-dark-base" />
                  <span>Everything in Pro</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-dark-base" />
                  <span>Exclusive Enterprise Prompts</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-dark-base" />
                  <span>Custom Prompt Requests</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-dark-base" />
                  <span>1-on-1 Consultation</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-dark-base" />
                  <span>Commercial License</span>
                </div>
              </div>
              <Button className="w-full mt-6 bg-dark-base hover:bg-dark-base/90" asChild>
                <Link to="/checkout?plan=premium">
                  Get Premium
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* FAQ Section */}
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-6 text-dark-base">
            Frequently Asked Questions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-left">Is this really a one-time payment?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-left text-muted-foreground">
                  Yes! Pay once and get lifetime access to your chosen plan with all future updates included.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-left">Can I upgrade later?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-left text-muted-foreground">
                  Absolutely! You can upgrade to a higher plan anytime by paying the difference.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
