
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PricingSection } from "@/components/pricing/PricingSection";
import { HeroSection } from "@/components/sections/HeroSection";
import { FeatureHighlights } from "@/components/sections/FeatureHighlights";
import { CategoryShowcase } from "@/components/sections/CategoryShowcase";
import { useAuth } from "@/contexts/AuthContext";
import { Container } from "@/components/ui/container";

export default function HomePage() {
  const { user } = useAuth();

  return (
    <main className="min-h-screen bg-gradient-to-br from-soft-bg via-warm-gold/10 to-muted-teal/20">
      {/* Hero Section */}
      <HeroSection />

      {/* Feature Highlights */}
      <FeatureHighlights />
      
      {/* Category Showcase */}
      <CategoryShowcase />
      
      {/* Pricing Preview (only shown if user is not logged in) */}
      {!user && (
        <section className="py-16 bg-white/10 backdrop-blur-sm">
          <Container>
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Get Started with a Plan That Fits Your Needs</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Choose from our range of plans designed to give you access to premium AI prompts that enhance your creativity and productivity
              </p>
            </div>
            <PricingSection />
          </Container>
        </section>
      )}

      {/* Testimonials Section - Future enhancement */}
      
      {/* Final Call To Action */}
      <section className="py-16 bg-dark-base/30 text-white backdrop-blur-sm">
        <Container className="text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Enhance Your AI Experience?</h2>
          <p className="text-lg mb-8 max-w-2xl mx-auto opacity-90">
            Join JojoPrompts today and unlock a world of curated, premium AI prompts designed to elevate your projects
          </p>
          <Button asChild size="lg" className="bg-warm-gold hover:bg-warm-gold/90 text-white px-8 py-6 font-semibold text-base">
            <Link to={user ? "/prompts" : "/pricing"}>
              {user ? "Browse Prompts" : "Get Started Now"}
            </Link>
          </Button>
        </Container>
      </section>
    </main>
  );
}
