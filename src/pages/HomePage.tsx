
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PricingSection } from "@/components/pricing/PricingSection";
import { HeroSection } from "@/components/sections/HeroSection";
import { FeatureHighlights } from "@/components/sections/FeatureHighlights";
import { CategoryShowcase } from "@/components/sections/CategoryShowcase";
import { useAuth } from "@/contexts/AuthContext";
import { Container } from "@/components/ui/container";
import { useIsMobile } from '@/hooks/use-mobile';

export default function HomePage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();

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
        <section id="pricing" className="mobile-section-padding bg-white/10 backdrop-blur-sm">
          <Container>
            <div className="text-center mb-8 sm:mb-12 mobile-container-padding">
              <h2 className="section-title mobile-text-center">
                Get Started with a Plan That Fits Your Needs
              </h2>
              <p className="section-subtitle mobile-text-center">
                Choose from our range of plans designed to give you access to premium AI prompts that enhance your creativity and productivity
              </p>
            </div>
            <PricingSection />
          </Container>
        </section>
      )}

      {/* Final Call To Action */}
      <section className="mobile-section-padding bg-dark-base/30 text-white backdrop-blur-sm">
        <Container className="text-center mobile-container-padding">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 mobile-text-center">
            Ready to Enhance Your AI Experience?
          </h2>
          <p className="text-base sm:text-lg mb-6 sm:mb-8 max-w-2xl mx-auto opacity-90 mobile-text-center">
            Join JojoPrompts today and unlock a world of curated, premium AI prompts designed to elevate your projects
          </p>
          <Button 
            asChild 
            size={isMobile ? "default" : "lg"}
            className="mobile-button-primary bg-warm-gold hover:bg-warm-gold/90 text-white px-6 sm:px-8 py-3 sm:py-6 font-semibold text-base sm:text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
          >
            <Link to={user ? "/prompts" : "/pricing"}>
              {user ? "Browse Prompts" : "Get Started Now"}
            </Link>
          </Button>
        </Container>
      </section>
    </main>
  );
}
