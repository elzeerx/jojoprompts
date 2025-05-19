
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { ArrowRight, Camera, Check, Copy, Sparkles, Star, Users } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  const isMobile = useIsMobile();
  
  return (
    <main className="min-h-screen overflow-hidden bg-soft-background">
      {/* Hero Section with Glassmorphism */}
      <section className="relative overflow-hidden py-20 md:py-32">
        {/* Background Gradient Elements */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-warm-gold/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 opacity-70"></div>
        <div className="absolute top-1/3 right-0 w-96 h-96 bg-muted-teal/20 rounded-full blur-3xl translate-x-1/3 opacity-60"></div>
        <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-warm-gold/20 rounded-full blur-3xl opacity-60"></div>
        
        <div className="container relative flex flex-col items-center">
          <div className="flex flex-col items-center max-w-3xl mx-auto text-center space-y-6">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-gradient-gold">
              Generate Amazing Images with AI Prompts
            </h1>
            
            <div className="glassmorphism bg-white/10 p-6 rounded-xl mb-4 max-w-2xl">
              <p className="text-lg md:text-xl text-dark-base font-medium mb-4">
                No recurring subscription, pay once and enjoy forever.
              </p>
              <p className="text-muted-foreground">
                All prompts are hand-picked and very customizable to fit your needs.
                <br className="hidden md:block" /> Special Arabic-crafted prompts included.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              <Button asChild size="lg" className="font-medium px-8 py-6 rounded-xl shadow-lg bg-warm-gold hover:bg-warm-gold/90 text-white">
                <Link to="/prompts">Choose Your Plan</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="font-medium px-8 py-6 rounded-xl border-warm-gold/30 text-dark-base hover:bg-warm-gold/10">
                <Link to="/signup">Create Account</Link>
              </Button>
            </div>
          </div>
          
          {/* Hero Image */}
          <div className="w-full max-w-5xl mx-auto mt-16">
            <div className="relative w-full overflow-hidden rounded-2xl shadow-2xl border border-white/10 glassmorphism">
              <AspectRatio ratio={isMobile ? 1 : 16/9} className="bg-dark-base/5">
                <img 
                  src="/lovable-uploads/eea1bdcd-7738-4e5f-810a-15c96fe07b94.png" 
                  alt="AI-generated prompts showcase" 
                  className="object-cover w-full h-full"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-dark-base/60 to-transparent"></div>
                <div className="absolute bottom-0 left-0 w-full p-4 md:p-8">
                  <div className="glassmorphism bg-white/20 backdrop-blur-md border border-white/20 rounded-xl p-4 inline-block">
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
      
      {/* Pricing Tiers Section */}
      <section className="py-20 relative">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-muted-teal/10 rounded-full blur-3xl opacity-60"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-warm-gold/10 rounded-full blur-3xl opacity-60"></div>
        
        <div className="container relative">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-dark-base mb-4">Choose Your Plan</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Select the perfect plan for your needs. No recurring subscriptions, just a one-time payment for high-quality AI prompts and resources.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {pricingTiers.map((tier) => (
              <Card key={tier.id} className={`overflow-hidden rounded-xl border-0 transition-all duration-300 hover:translate-y-[-4px] relative ${tier.highlight ? 'border-warm-gold/50 shadow-xl shadow-warm-gold/20' : 'shadow-lg'}`}>
                {tier.highlight && (
                  <div className="absolute top-0 right-0 left-0">
                    <Badge className="absolute top-4 right-4 bg-warm-gold text-white border-0">Most Popular</Badge>
                  </div>
                )}
                <div className={`p-6 ${tier.highlight ? 'bg-gradient-to-br from-warm-gold/10 to-muted-teal/10' : 'bg-white/50 backdrop-blur-sm'}`}>
                  <h3 className="text-xl font-bold text-dark-base mb-2">{tier.name}</h3>
                  <div className="flex items-baseline mb-4">
                    <span className="text-4xl font-bold text-warm-gold">${tier.price}</span>
                    <span className="text-sm text-muted-foreground ml-2">({tier.kuwaitPrice} KWD)</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{tier.description}</p>
                </div>
                
                <CardContent className="p-6 border-t border-border">
                  <ul className="space-y-3">
                    {tier.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-warm-gold shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                
                <CardFooter className="p-6 pt-0">
                  <Button className={`w-full py-6 rounded-xl ${tier.highlight ? 'bg-warm-gold hover:bg-warm-gold/90' : 'bg-muted-teal hover:bg-muted-teal/90'} text-white`}>
                    Get Started
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>
      
      {/* Featured Prompts Section */}
      <section className="py-20 bg-gradient-to-b from-soft-background to-muted-teal/5 relative">
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-full max-w-[1000px] h-px bg-gradient-to-r from-transparent via-warm-gold/30 to-transparent"></div>
        
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-dark-base mb-3">Featured Prompts</h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
              Get inspired with these popular prompts from our collection
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredPrompts.map((prompt) => (
              <Card key={prompt.id} className="overflow-hidden rounded-xl border-0 glassmorphism hover:shadow-lg transition-all duration-300 hover:translate-y-[-4px]">
                <AspectRatio ratio={4/3}>
                  <img src={prompt.image} alt={prompt.title} className="object-cover w-full h-full" />
                </AspectRatio>
                <CardContent className="p-6">
                  <h3 className="font-bold text-lg mb-2 text-dark-base">{prompt.title}</h3>
                  <p className="text-muted-foreground text-sm mb-4">{prompt.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex space-x-1">
                      {Array(5).fill(0).map((_, i) => (
                        <Star key={i} className={`h-4 w-4 ${i < prompt.rating ? 'fill-warm-gold text-warm-gold' : 'text-muted-foreground/30'}`} />
                      ))}
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs hover:bg-warm-gold/10 hover:text-warm-gold">
                      <Copy className="h-3 w-3 mr-1" /> Copy
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="flex justify-center mt-12">
            <Button asChild variant="outline" className="rounded-xl bg-white/50 backdrop-blur-sm border-warm-gold/30 text-dark-base hover:bg-warm-gold/10">
              <Link to="/prompts" className="flex items-center gap-2">
                View All Prompts <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
      
      {/* How It Works Section */}
      <section className="py-20 bg-soft-background">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-dark-base">How JojoPrompts Works</h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
              Using our prompts is simple and effective
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-4xl mx-auto">
            {howItWorks.map((step) => (
              <div key={step.id} className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-warm-gold/10 flex items-center justify-center mb-4">
                  {step.icon}
                </div>
                <h3 className="text-xl font-semibold mb-3 text-dark-base">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-br from-warm-gold/5 to-muted-teal/10">
        <div className="container">
          <div className="max-w-3xl mx-auto p-8 md:p-12 glassmorphism border border-white/20 rounded-2xl text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4 text-dark-base">Ready to create amazing AI images?</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Join our community of creators and unlock your creative potential with our curated prompt collection.
            </p>
            <Button asChild size="lg" className="font-medium px-8 py-6 rounded-xl bg-warm-gold hover:bg-warm-gold/90 text-white">
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
    icon: <Camera className="w-6 h-6 text-warm-gold" />,
  },
  {
    id: 2,
    title: "Copy",
    description: "Find the perfect prompt and copy it with a single click, ready to use.",
    icon: <Copy className="w-6 h-6 text-warm-gold" />,
  },
  {
    id: 3,
    title: "Create",
    description: "Paste the prompt into your favorite AI tool and create stunning images instantly.",
    icon: <Sparkles className="w-6 h-6 text-warm-gold" />,
  },
];

// Pricing tiers
const pricingTiers = [
  {
    id: 1,
    name: "Basic",
    price: 55,
    kuwaitPrice: 15,
    description: "1-year access, non-renewal",
    features: [
      "ChatGPT prompts only",
      "Curated collection",
      "Regular updates for 1 year",
      "Access to basic tutorials"
    ],
    highlight: false
  },
  {
    id: 2,
    name: "Standard",
    price: 65,
    kuwaitPrice: 20,
    description: "1-year access, non-renewal",
    features: [
      "All ChatGPT prompts",
      "All Midjourney prompts",
      "Regular updates for 1 year",
      "Access to basic tutorials"
    ],
    highlight: false
  },
  {
    id: 3,
    name: "Premium",
    price: 80,
    kuwaitPrice: 25,
    description: "Lifetime access, all updates",
    features: [
      "All ChatGPT prompts",
      "All Midjourney prompts",
      "n8n workflows",
      "Future categories",
      "Lifetime updates"
    ],
    highlight: true
  },
  {
    id: 4,
    name: "Ultimate",
    price: 100,
    kuwaitPrice: 30,
    description: "Lifetime access + custom prompts",
    features: [
      "All ChatGPT prompts",
      "All Midjourney prompts",
      "n8n workflows",
      "Future categories",
      "20 special prompt requests",
      "Priority support"
    ],
    highlight: false
  }
];
