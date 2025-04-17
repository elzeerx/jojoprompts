
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { FileText, Sparkles, Copy, Download } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem-1px)]">
      {/* Hero Section */}
      <section className="flex-1 py-20 md:py-32 bg-gradient-to-b from-secondary to-background">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center space-y-4 text-center">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl">
                Discover & Create Amazing
                <span className="text-primary"> AI Image Prompts</span>
              </h1>
              <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
                Browse high-quality prompts for AI image generation. Copy, export, and create stunning visuals with ease.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild size="lg">
                <Link to="/prompts">Browse Prompts</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/signup">Create Account</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-secondary/50">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Your Creative Toolkit
              </h2>
              <p className="mx-auto max-w-[700px] text-muted-foreground">
                Everything you need to take your AI image generation to the next level.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
              <div className="flex flex-col items-center space-y-2 p-6 bg-background rounded-lg shadow-sm border">
                <div className="p-3 rounded-full bg-primary/10 text-primary">
                  <FileText className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold">Browse Prompts</h3>
                <p className="text-muted-foreground text-center">
                  Explore our curated collection of high-quality prompts for various styles and concepts.
                </p>
              </div>
              
              <div className="flex flex-col items-center space-y-2 p-6 bg-background rounded-lg shadow-sm border">
                <div className="p-3 rounded-full bg-primary/10 text-primary">
                  <Copy className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold">Copy & Use</h3>
                <p className="text-muted-foreground text-center">
                  Quickly copy prompts to use with ChatGPT, Midjourney, DALL-E, or your favorite AI image generator.
                </p>
              </div>
              
              <div className="flex flex-col items-center space-y-2 p-6 bg-background rounded-lg shadow-sm border">
                <div className="p-3 rounded-full bg-primary/10 text-primary">
                  <Download className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold">Export Collection</h3>
                <p className="text-muted-foreground text-center">
                  Select multiple prompts and export them to PDF for your personal collection.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Ready to Create Amazing Images?
              </h2>
              <p className="mx-auto max-w-[700px] opacity-90">
                Join our community today and unlock your creative potential with AI prompts.
              </p>
            </div>
            <Button asChild size="lg" variant="secondary" className="mt-4">
              <Link to="/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
