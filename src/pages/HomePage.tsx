
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Sparkles, Zap, Star, Users } from "lucide-react";
import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-soft-bg via-warm-gold/10 to-muted-teal/20">
      {/* Hero Section */}
      <section className="mobile-container-padding py-16 lg:py-24">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <div className="rounded-full bg-warm-gold/10 p-4 border-2 border-warm-gold/20">
              <Sparkles className="h-12 w-12 text-warm-gold" />
            </div>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 text-dark-base">
            Premium AI Prompts for
            <span className="block bg-gradient-to-r from-warm-gold to-muted-teal bg-clip-text text-transparent">
              Creative Excellence
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
            Unlock the full potential of AI with our curated collection of professional prompts for ChatGPT, Midjourney, and more.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button asChild size="lg" className="mobile-button-primary">
              <Link to="/prompts" className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Browse Prompts
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            
            <Button asChild variant="outline" size="lg" className="mobile-button-secondary">
              <Link to="/pricing">
                View Pricing
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="mobile-container-padding py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-dark-base">
              Why Choose JojoPrompts?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Join thousands of creators who trust our premium prompt collection
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="text-center border-2 border-warm-gold/20 bg-warm-gold/5">
              <CardHeader>
                <div className="flex justify-center mb-4">
                  <div className="rounded-full bg-warm-gold/10 p-3">
                    <Star className="h-8 w-8 text-warm-gold" />
                  </div>
                </div>
                <CardTitle className="text-xl text-dark-base">Premium Quality</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Every prompt is carefully crafted and tested by AI experts to ensure optimal results.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center border-2 border-muted-teal/20 bg-muted-teal/5">
              <CardHeader>
                <div className="flex justify-center mb-4">
                  <div className="rounded-full bg-muted-teal/10 p-3">
                    <Zap className="h-8 w-8 text-muted-teal" />
                  </div>
                </div>
                <CardTitle className="text-xl text-dark-base">One-Time Payment</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Pay once and get lifetime access to our entire prompt library with regular updates.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center border-2 border-warm-gold/20 bg-warm-gold/5">
              <CardHeader>
                <div className="flex justify-center mb-4">
                  <div className="rounded-full bg-warm-gold/10 p-3">
                    <Users className="h-8 w-8 text-warm-gold" />
                  </div>
                </div>
                <CardTitle className="text-xl text-dark-base">Community Driven</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Join a community of creators and get support, tips, and new prompt suggestions.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="mobile-container-padding py-16">
        <div className="max-w-4xl mx-auto text-center">
          <Card className="border-2 border-warm-gold/30 bg-gradient-to-r from-warm-gold/10 to-muted-teal/10">
            <CardHeader>
              <CardTitle className="text-2xl md:text-3xl text-dark-base">
                Ready to Transform Your AI Experience?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-lg text-muted-foreground">
                Get instant access to hundreds of premium AI prompts and start creating amazing content today.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" className="mobile-button-primary">
                  <Link to="/pricing" className="flex items-center gap-2">
                    Get Started Now
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="mobile-button-secondary">
                  <Link to="/about">
                    Learn More
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
