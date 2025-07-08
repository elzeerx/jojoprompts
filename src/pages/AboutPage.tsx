
import { Button } from "@/components/ui/button";
import { FileText, Sparkles, Copy, Download, Zap, Users, Shield, Star } from "lucide-react";
import { Link } from "react-router-dom";

export default function AboutPage() {
  return (
    <div className="mobile-container-padding mobile-section-padding max-w-4xl mx-auto">
      <div className="text-center mb-8 sm:mb-12">
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-warm-gold/10 p-3 sm:p-4">
            <FileText className="h-8 w-8 sm:h-10 sm:w-10 text-warm-gold" />
          </div>
        </div>
        <h1 className="section-title mb-4 text-dark-base">About JojoPrompts</h1>
        <p className="section-subtitle max-w-3xl mx-auto">
          A passion project by Nawaf Alsuwaiyed, sharing carefully curated AI prompts that have been tested and refined through real-world use. 
          Discover prompts that actually work for ChatGPT, Midjourney, Claude, and other AI tools.
        </p>
      </div>
      
      <div className="mobile-element-spacing">
        <section>
          <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-dark-base text-center">The Story Behind JojoPrompts</h2>
          <div className="bg-warm-gold/5 p-6 sm:p-8 rounded-lg border border-warm-gold/20">
            <p className="text-base sm:text-lg text-muted-foreground mb-4 leading-relaxed">
              JojoPrompts was born from a simple frustration: spending hours crafting the perfect AI prompt, only to forget it later. 
              Nawaf Alsuwaiyed, a passionate AI enthusiast and prompt engineer, decided to solve this problem by creating a centralized 
              hub for his ever-growing collection of effective prompts.
            </p>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
              What started as a personal library has evolved into a curated platform where quality trumps quantity. 
              Every prompt here has been battle-tested in real projects, refined through iterations, and proven to deliver 
              exceptional results across different AI platforms.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-dark-base text-center">What Makes JojoPrompts Special?</h2>
          <div className="mobile-grid gap-6 sm:gap-8">
            <div className="mobile-card text-center hover:shadow-md transition-shadow">
              <div className="rounded-full bg-warm-gold/10 p-4 mb-4 mx-auto w-fit">
                <Star className="h-6 w-6 text-warm-gold" />
              </div>
              <h3 className="font-semibold text-lg sm:text-xl mb-3 text-dark-base">Battle-Tested Quality</h3>
              <p className="text-muted-foreground leading-relaxed">
                No fluff, no filler. Every prompt has been used in real projects and refined based on actual results.
              </p>
            </div>
            
            <div className="mobile-card text-center hover:shadow-md transition-shadow">
              <div className="rounded-full bg-warm-gold/10 p-4 mb-4 mx-auto w-fit">
                <Users className="h-6 w-6 text-warm-gold" />
              </div>
              <h3 className="font-semibold text-lg sm:text-xl mb-3 text-dark-base">Personal Touch</h3>
              <p className="text-muted-foreground leading-relaxed">
                Each prompt comes with context and tips from real-world usage, not just copy-paste text.
              </p>
            </div>
            
            <div className="mobile-card text-center hover:shadow-md transition-shadow">
              <div className="rounded-full bg-warm-gold/10 p-4 mb-4 mx-auto w-fit">
                <Sparkles className="h-6 w-6 text-warm-gold" />
              </div>
              <h3 className="font-semibold text-lg sm:text-xl mb-3 text-dark-base">Constantly Evolving</h3>
              <p className="text-muted-foreground leading-relaxed">
                As AI tools evolve, so do our prompts. Regular updates ensure compatibility with the latest models.
              </p>
            </div>
          </div>
        </section>
        
        <section>
          <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-dark-base text-center">What You'll Find Here</h2>
          <div className="mobile-grid-2 gap-6 sm:gap-8">
            <div className="mobile-card hover:shadow-md transition-shadow">
              <div className="flex items-start space-x-4">
                <div className="rounded-full bg-warm-gold/10 p-3 flex-shrink-0">
                  <Copy className="h-5 w-5 text-warm-gold" />
                </div>
                <div>
                  <h3 className="font-semibold text-base sm:text-lg mb-2 text-dark-base">One-Click Copy</h3>
                  <p className="text-sm sm:text-base text-muted-foreground">
                    Click to copy any prompt instantly. No sign-ups, no downloads, just immediate access 
                    to prompts you can use right away in your favorite AI tools.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mobile-card hover:shadow-md transition-shadow">
              <div className="flex items-start space-x-4">
                <div className="rounded-full bg-warm-gold/10 p-3 flex-shrink-0">
                  <Star className="h-5 w-5 text-warm-gold" />
                </div>
                <div>
                  <h3 className="font-semibold text-base sm:text-lg mb-2 text-dark-base">Favorites Collection</h3>
                  <p className="text-sm sm:text-base text-muted-foreground">
                    Save your favorite prompts to your personal collection for quick access. 
                    Build your own curated library of go-to prompts.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mobile-card hover:shadow-md transition-shadow">
              <div className="flex items-start space-x-4">
                <div className="rounded-full bg-warm-gold/10 p-3 flex-shrink-0">
                  <Zap className="h-5 w-5 text-warm-gold" />
                </div>
                <div>
                  <h3 className="font-semibold text-base sm:text-lg mb-2 text-dark-base">Smart Search</h3>
                  <p className="text-sm sm:text-base text-muted-foreground">
                    Find exactly what you need with our intelligent search. Filter by category, 
                    AI platform, or search through prompt content to discover new possibilities.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mobile-card hover:shadow-md transition-shadow">
              <div className="flex items-start space-x-4">
                <div className="rounded-full bg-warm-gold/10 p-3 flex-shrink-0">
                  <Sparkles className="h-5 w-5 text-warm-gold" />
                </div>
                <div>
                  <h3 className="font-semibold text-base sm:text-lg mb-2 text-dark-base">Multi-Platform Ready</h3>
                  <p className="text-sm sm:text-base text-muted-foreground">
                    Prompts for ChatGPT, Claude, Midjourney, DALL-E, Stable Diffusion, and more. 
                    Each prompt is optimized for the platform it's designed for.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-warm-gold/5 p-6 sm:p-8 rounded-lg border border-warm-gold/20">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-dark-base text-center">Start Your Journey</h2>
          <p className="text-base sm:text-lg text-muted-foreground mb-6 sm:mb-8 text-center max-w-3xl mx-auto">
            Ready to transform your AI interactions? Dive into our collection of proven prompts and discover 
            how the right words can unlock incredible results. No complicated setups, no lengthy tutorials—just 
            copy, paste, and create amazing content.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="mobile-button-primary">
              <Link to="/prompts">Browse All Prompts</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="mobile-button-secondary">
              <Link to="/pricing">Join the Community</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
