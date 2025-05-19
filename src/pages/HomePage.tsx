
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PricingSection } from "@/components/pricing/PricingSection";
import { HeroSection } from "@/components/sections/HeroSection";
import { FeatureHighlights } from "@/components/sections/FeatureHighlights";
import { CategoryShowcase } from "@/components/sections/CategoryShowcase";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-soft-bg">
      {/* Hero Section */}
      <HeroSection />

      {/* Feature Highlights */}
      <FeatureHighlights />
      
      {/* Category Showcase */}
      <CategoryShowcase />

      {/* Pricing Section */}
      <PricingSection />
      
      {/* Testimonials Section - Future enhancement */}
      
      {/* Final Call To Action */}
      <section className="py-16 bg-dark-base text-soft-bg">
        <div className="container text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Enhance Your AI Experience?</h2>
          <p className="text-lg mb-8 max-w-2xl mx-auto opacity-90">
            Join JojoPrompts today and unlock a world of curated, premium AI prompts designed to elevate your projects
          </p>
          <Button asChild size="lg" className="bg-warm-gold hover:bg-warm-gold/90 text-white px-8 py-6 font-semibold text-base">
            <Link to="/prompts">Browse Prompts</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
