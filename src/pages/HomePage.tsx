
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { ArrowRight, Camera, Copy, Sparkles, Star, Users } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export default function HomePage() {
  const isMobile = useIsMobile();
  
  return (
    <main className="min-h-screen overflow-hidden">
      {/* Hero Section with Glassmorphism */}
      <section className="relative overflow-hidden">
        {/* Background Gradient Elements */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 opacity-70"></div>
        <div className="absolute top-1/3 right-0 w-96 h-96 bg-accent/20 rounded-full blur-3xl translate-x-1/3 opacity-60"></div>
        <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-secondary/20 rounded-full blur-3xl opacity-60"></div>
        
        <div className="container relative py-20 md:py-32 flex flex-col items-center">
          <div className="flex flex-col items-center max-w-3xl mx-auto text-center space-y-6">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight bg-gradient-to-br from-primary to-primary/70 bg-clip-text text-transparent">
              Generate Amazing Images with AI Prompts
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl">
              Browse and use our curated collection of high-quality, ready-to-use AI image generation prompts. Perfect for ChatGPT, Midjourney, or Stable Diffusion.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              <Button asChild size="lg" className="font-medium px-8 py-6 rounded-xl shadow-lg">
                <Link to="/prompts">Browse Prompts</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="font-medium px-8 py-6 rounded-xl border-primary/20 bg-background/60 backdrop-blur-sm">
                <Link to="/signup">Create Account</Link>
              </Button>
            </div>
          </div>
          
          {/* Hero Image */}
          <div className="w-full max-w-5xl mx-auto mt-16">
            <div className="relative w-full overflow-hidden rounded-2xl shadow-2xl border border-white/10">
              <AspectRatio ratio={isMobile ? 1 : 16/9} className="bg-accent/5">
                <img 
                  src="/lovable-uploads/eea1bdcd-7738-4e5f-810a-15c96fe07b94.png" 
                  alt="AI-generated prompts showcase" 
                  className="object-cover w-full h-full"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                <div className="absolute bottom-0 left-0 w-full p-4 md:p-8">
                  <div className="bg-background/40 backdrop-blur-md border border-white/20 rounded-xl p-4 inline-block">
                    <p className="text-sm md:text-base font-medium text-white">
                      Explore hundreds of curated prompts to create images like this!
                    </p>
                  </div>
                </div>
              </AspectRatio>
            </div>
          </div>
        </div>
      </section>
      
      {/* Featured Prompts Section */}
      <section className="py-20 bg-gradient-to-b from-background to-secondary/20">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold">Featured Prompts</h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
              Get inspired with these popular prompts from our collection
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredPrompts.map((prompt) => (
              <Card key={prompt.id} className="overflow-hidden rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 hover:shadow-lg transition-all">
                <AspectRatio ratio={4/3}>
                  <img src={prompt.image} alt={prompt.title} className="object-cover w-full h-full" />
                </AspectRatio>
                <CardContent className="p-4">
                  <h3 className="font-bold text-lg mb-2">{prompt.title}</h3>
                  <p className="text-muted-foreground text-sm mb-4">{prompt.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex space-x-1">
                      {Array(5).fill(0).map((_, i) => (
                        <Star key={i} className={`h-4 w-4 ${i < prompt.rating ? 'fill-primary text-primary' : 'text-muted'}`} />
                      ))}
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs">
                      <Copy className="h-3 w-3 mr-1" /> Copy
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="flex justify-center mt-12">
            <Button asChild variant="outline" className="rounded-xl bg-background/60 backdrop-blur-sm">
              <Link to="/prompts" className="flex items-center gap-2">
                View All Prompts <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
      
      {/* How It Works Section */}
      <section className="py-20 bg-background">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold">How JojoPrompts Works</h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
              Using our prompts is simple and effective
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-4xl mx-auto">
            {howItWorks.map((step) => (
              <div key={step.id} className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  {step.icon}
                </div>
                <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-br from-primary/5 to-secondary/10">
        <div className="container">
          <div className="max-w-3xl mx-auto p-8 md:p-12 bg-background/40 backdrop-blur-md border border-white/20 rounded-2xl text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to create amazing AI images?</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Join our community of creators and unlock your creative potential with our curated prompt collection.
            </p>
            <Button asChild size="lg" className="font-medium px-8 py-6 rounded-xl">
              <Link to="/prompts">Get Started Now</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}

// Sample data for featured prompts
const featuredPrompts = [
  {
    id: 1,
    title: "Cyberpunk City Night",
    description: "A neon-lit cyberpunk cityscape with flying cars and holographic advertisements.",
    image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=2835&auto=format&fit=crop",
    rating: 5,
  },
  {
    id: 2,
    title: "Fantasy Forest",
    description: "Enchanted forest with glowing plants, mystical creatures, and a magical atmosphere.",
    image: "https://images.unsplash.com/photo-1516541196182-6bdb0516ed27?q=80&w=2787&auto=format&fit=crop",
    rating: 4,
  },
  {
    id: 3,
    title: "Futuristic Portrait",
    description: "Portrait of a person with futuristic elements, technological enhancements, and sci-fi style.",
    image: "https://images.unsplash.com/photo-1543000968-2eb928cd8cc2?q=80&w=2835&auto=format&fit=crop",
    rating: 5,
  },
];

// How it works steps
const howItWorks = [
  {
    id: 1,
    title: "Browse",
    description: "Explore our curated collection of AI prompts organized by categories and styles.",
    icon: <Camera className="w-6 h-6 text-primary" />,
  },
  {
    id: 2,
    title: "Copy",
    description: "Find the perfect prompt and copy it with a single click, ready to use.",
    icon: <Copy className="w-6 h-6 text-primary" />,
  },
  {
    id: 3,
    title: "Create",
    description: "Paste the prompt into your favorite AI tool and create stunning images instantly.",
    icon: <Sparkles className="w-6 h-6 text-primary" />,
  },
];
