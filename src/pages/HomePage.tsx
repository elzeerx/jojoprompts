
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { FileText, Sparkles, Copy, Download, ShieldCheck } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem-1px)]">
      {/* Hero Section */}
      <section className="flex-1 py-20 md:py-32 bg-gradient-to-b from-secondary to-background">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center space-y-4 text-center">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl">
                Public AI Image Prompts Gallery
              </h1>
              <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
                Discover a curated gallery of AI-generated image prompts. Browse and export high-quality prompts, handpicked by our curators and admin team. 
                <span className="block mt-4 text-primary font-semibold">
                  <Sparkles className="inline h-5 w-5 mb-1 mr-1" />
                  Only admins can create and add prompts. Members can discover, search, and export prompts after logging in.
                </span>
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild size="lg">
                <Link to="/login">Log In to Browse Prompts</Link>
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
                Your AI Visual Discovery Toolkit
              </h2>
              <p className="mx-auto max-w-[700px] text-muted-foreground">
                Easily browse prompts for AI image generation—no prompt creation required!
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
              <div className="flex flex-col items-center space-y-2 p-6 bg-background rounded-lg shadow-sm border">
                <div className="p-3 rounded-full bg-primary/10 text-primary">
                  <FileText className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold">Curated Prompts</h3>
                <p className="text-muted-foreground text-center">
                  Explore prompts added and quality-checked by admins—members only need to log in to access the collection.
                </p>
              </div>

              <div className="flex flex-col items-center space-y-2 p-6 bg-background rounded-lg shadow-sm border">
                <div className="p-3 rounded-full bg-primary/10 text-primary">
                  <Copy className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold">Copy & Use</h3>
                <p className="text-muted-foreground text-center">
                  Easily copy prompt text or export a collection for use with your favorite AI image generator.
                </p>
              </div>

              <div className="flex flex-col items-center space-y-2 p-6 bg-background rounded-lg shadow-sm border">
                <div className="p-3 rounded-full bg-primary/10 text-primary">
                  <Download className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold">Export, Don’t Create</h3>
                <p className="text-muted-foreground text-center">
                  Download prompts as a PDF for inspiration and exploration. Prompt creation and curation are handled by admins.
                </p>
              </div>
            </div>
            <div className="mt-4 text-muted-foreground flex items-center justify-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Want to contribute? Contact the site admin to suggest new prompts.
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
                Unlock easy access to inspiring AI image ideas!
              </h2>
              <p className="mx-auto max-w-[700px] opacity-90">
                Sign up or log in to start browsing our ever-growing library of prompts curated just for you.
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
