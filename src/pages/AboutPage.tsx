
import { Button } from "@/components/ui/button";
import { FileText, Sparkles, Copy, Download, Zap, Users, Shield, Star } from "lucide-react";
import { Link } from "react-router-dom";

export default function AboutPage() {
  return (
    <div className="container py-12 max-w-4xl">
      <div className="text-center mb-12">
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-warm-gold/10 p-4">
            <FileText className="h-10 w-10 text-warm-gold" />
          </div>
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-4 text-dark-base">About JojoPrompts</h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          The premier platform for discovering, creating, and sharing professional-grade AI prompts. 
          Unlock your creative potential with our curated collection of high-quality prompts for all major AI platforms.
        </p>
      </div>
      
      <div className="space-y-16">
        <section>
          <h2 className="text-3xl font-bold mb-6 text-dark-base text-center">Our Mission</h2>
          <div className="bg-warm-gold/5 p-8 rounded-lg border border-warm-gold/20">
            <p className="text-lg text-muted-foreground mb-4 leading-relaxed">
              At JojoPrompts, we believe that exceptional AI-generated content starts with exceptional prompts. 
              Our mission is to democratize access to premium prompt engineering expertise, empowering creators, 
              marketers, developers, and artists to achieve professional results with AI tools.
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed">
              We're committed to building the world's most comprehensive and highest-quality prompt library, 
              backed by expert curation and continuous innovation in AI prompt engineering.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-bold mb-8 text-dark-base text-center">Why Choose JojoPrompts?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center p-6 border border-warm-gold/20 rounded-lg bg-background shadow-sm hover:shadow-md transition-shadow">
              <div className="rounded-full bg-warm-gold/10 p-4 mb-4">
                <Star className="h-6 w-6 text-warm-gold" />
              </div>
              <h3 className="font-semibold text-xl mb-3 text-dark-base">Premium Quality</h3>
              <p className="text-muted-foreground leading-relaxed">
                Every prompt is expertly crafted and tested to ensure maximum effectiveness across all AI platforms.
              </p>
            </div>
            
            <div className="flex flex-col items-center text-center p-6 border border-warm-gold/20 rounded-lg bg-background shadow-sm hover:shadow-md transition-shadow">
              <div className="rounded-full bg-warm-gold/10 p-4 mb-4">
                <Users className="h-6 w-6 text-warm-gold" />
              </div>
              <h3 className="font-semibold text-xl mb-3 text-dark-base">Community Driven</h3>
              <p className="text-muted-foreground leading-relaxed">
                Join a thriving community of creators sharing insights, techniques, and breakthrough prompts.
              </p>
            </div>
            
            <div className="flex flex-col items-center text-center p-6 border border-warm-gold/20 rounded-lg bg-background shadow-sm hover:shadow-md transition-shadow">
              <div className="rounded-full bg-warm-gold/10 p-4 mb-4">
                <Shield className="h-6 w-6 text-warm-gold" />
              </div>
              <h3 className="font-semibold text-xl mb-3 text-dark-base">Trusted & Secure</h3>
              <p className="text-muted-foreground leading-relaxed">
                Professional-grade security and privacy protection for your creative projects and data.
              </p>
            </div>
          </div>
        </section>
        
        <section>
          <h2 className="text-3xl font-bold mb-8 text-dark-base text-center">Powerful Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex items-start space-x-4 p-6 border border-warm-gold/20 rounded-lg bg-background shadow-sm">
              <div className="rounded-full bg-warm-gold/10 p-3 flex-shrink-0">
                <Copy className="h-5 w-5 text-warm-gold" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2 text-dark-base">Instant Access & Copy</h3>
                <p className="text-muted-foreground">
                  Browse thousands of categorized prompts and copy them instantly to use with ChatGPT, 
                  Midjourney, Stable Diffusion, and other AI tools.
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4 p-6 border border-warm-gold/20 rounded-lg bg-background shadow-sm">
              <div className="rounded-full bg-warm-gold/10 p-3 flex-shrink-0">
                <Download className="h-5 w-5 text-warm-gold" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2 text-dark-base">Professional Exports</h3>
                <p className="text-muted-foreground">
                  Create custom collections and export them as beautifully formatted PDFs for 
                  offline reference, team sharing, or client presentations.
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4 p-6 border border-warm-gold/20 rounded-lg bg-background shadow-sm">
              <div className="rounded-full bg-warm-gold/10 p-3 flex-shrink-0">
                <Zap className="h-5 w-5 text-warm-gold" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2 text-dark-base">AI-Powered Discovery</h3>
                <p className="text-muted-foreground">
                  Advanced AI categorization and smart search help you find the perfect prompt 
                  for any project or creative challenge.
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4 p-6 border border-warm-gold/20 rounded-lg bg-background shadow-sm">
              <div className="rounded-full bg-warm-gold/10 p-3 flex-shrink-0">
                <Sparkles className="h-5 w-5 text-warm-gold" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2 text-dark-base">Multi-Platform Support</h3>
                <p className="text-muted-foreground">
                  Specialized prompts for text generation, image creation, and workflow automation 
                  across all major AI platforms and tools.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-warm-gold/5 p-8 rounded-lg border border-warm-gold/20">
          <h2 className="text-3xl font-bold mb-6 text-dark-base text-center">Join the Revolution</h2>
          <p className="text-lg text-muted-foreground mb-8 text-center max-w-3xl mx-auto">
            Whether you're a content creator, marketer, developer, or artist, JojoPrompts provides 
            the tools and resources you need to excel in the AI-powered creative landscape. 
            Start your journey today and discover what's possible.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-warm-gold hover:bg-warm-gold/90">
              <Link to="/prompts">Explore Prompts</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-warm-gold text-warm-gold hover:bg-warm-gold/10">
              <Link to="/pricing">View Pricing</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
