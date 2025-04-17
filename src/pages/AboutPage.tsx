
import { Button } from "@/components/ui/button";
import { FileText, Github, Copy, Download, Zap } from "lucide-react";
import { Link } from "react-router-dom";

export default function AboutPage() {
  return (
    <div className="container py-12 max-w-4xl">
      <div className="text-center mb-12">
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-primary/10 p-4">
            <FileText className="h-10 w-10 text-primary" />
          </div>
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">About JojoPrompts</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Your go-to platform for discovering, sharing, and using high-quality AI image generation prompts.
        </p>
      </div>
      
      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-bold mb-4">Our Mission</h2>
          <p className="text-muted-foreground mb-4">
            JojoPrompts was created to solve a common problem: finding and organizing great prompts for AI image generation tools.
            Whether you're using ChatGPT, Midjourney, Stable Diffusion, or any other AI image generator, 
            having access to quality prompts can make a huge difference in your creative output.
          </p>
          <p className="text-muted-foreground">
            We believe that everyone should have access to tools that unlock their creativity,
            which is why we've built this platform to help you discover, save, and export the best prompts for your projects.
          </p>
        </section>
        
        <section>
          <h2 className="text-2xl font-bold mb-4">Key Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col items-center text-center p-4 border rounded-lg bg-background shadow-sm">
              <div className="rounded-full bg-primary/10 p-3 mb-4">
                <Copy className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Browse & Copy</h3>
              <p className="text-muted-foreground">
                Browse our curated collection and easily copy prompts to use with your favorite AI tools.
              </p>
            </div>
            
            <div className="flex flex-col items-center text-center p-4 border rounded-lg bg-background shadow-sm">
              <div className="rounded-full bg-primary/10 p-3 mb-4">
                <Download className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Export to PDF</h3>
              <p className="text-muted-foreground">
                Select and export multiple prompts to a PDF for easy reference offline.
              </p>
            </div>
            
            <div className="flex flex-col items-center text-center p-4 border rounded-lg bg-background shadow-sm">
              <div className="rounded-full bg-primary/10 p-3 mb-4">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">AI-Powered</h3>
              <p className="text-muted-foreground">
                Our platform uses AI to help categorize and generate new prompts (admin-only feature).
              </p>
            </div>
          </div>
        </section>
        
        <section>
          <h2 className="text-2xl font-bold mb-4">Get Started</h2>
          <p className="text-muted-foreground mb-6">
            Ready to explore our collection of creative prompts? Sign up for a free account to save your favorites
            and export collections to PDF.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg">
              <Link to="/prompts">Browse Prompts</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/signup">Create Account</Link>
            </Button>
          </div>
        </section>
        
        <section className="border-t pt-12">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">
              JojoPrompts is a demo project created for educational purposes.
            </p>
            <div className="flex justify-center">
              <a 
                href="https://github.com/jojocompany/jojoprompts" 
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-2 text-primary hover:underline"
              >
                <Github className="h-4 w-4" />
                View on GitHub
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
