
import React from 'react';
import { ArrowRight, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from "@/contexts/AuthContext";
import { Button } from '@/components/ui/button';

export function CategoryShowcase() {
  const { user } = useAuth();
  
  const categories = [
    {
      title: "ChatGPT Prompts",
      description: "Enhance your text generation with our premium ChatGPT prompts",
      image: "/lovable-uploads/eea1bdcd-7738-4e5f-810a-15c96fe07b94.png",
      bgColor: "bg-warm-gold/10",
      link: "/prompts/chatgpt",
      requiredPlan: "basic"
    },
    {
      title: "Midjourney Prompts",
      description: "Create stunning AI art with our carefully crafted Midjourney prompts",
      image: "/lovable-uploads/ff979f5e-633f-404f-8799-bd078ad6c678.png",
      bgColor: "bg-muted-teal/10",
      link: "/prompts/midjourney",
      requiredPlan: "standard"
    },
    {
      title: "N8N Workflows",
      description: "Automate your processes with our pre-made n8n workflow templates",
      image: "/lovable-uploads/eea1bdcd-7738-4e5f-810a-15c96fe07b94.png",
      bgColor: "bg-warm-gold/10",
      link: "/prompts/workflows",
      requiredPlan: "premium"
    }
  ];

  return (
    <section className="py-16">
      <div className="container">
        <h2 className="text-3xl font-bold text-center mb-4">Explore Our Categories</h2>
        <p className="text-lg text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
          Discover prompts for different AI platforms to enhance your creativity and productivity
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-12">
          {categories.map((category, index) => (
            <div 
              key={index} 
              className="group relative overflow-hidden rounded-lg border border-warm-gold/20 bg-white shadow-sm hover:shadow-md transition-all duration-300"
            >
              <div className={`h-48 overflow-hidden ${category.bgColor}`}>
                <img 
                  src={category.image} 
                  alt={category.title} 
                  className={`w-full h-full object-cover transition-transform group-hover:scale-105 ${!user ? "blur-sm" : ""}`} 
                />
                {!user && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Lock className="h-10 w-10 text-white opacity-80" />
                  </div>
                )}
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold mb-2 text-dark-base group-hover:text-warm-gold transition-colors">
                  {category.title}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {category.description}
                </p>
                {user ? (
                  <Link 
                    to={category.link}
                    className="flex items-center text-warm-gold font-medium"
                  >
                    <span>Explore Collection</span>
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                ) : (
                  <div className="flex flex-col space-y-2">
                    <p className="text-sm text-muted-foreground">
                      <span className="font-semibold">{category.requiredPlan} plan</span> or higher required
                    </p>
                    <Button 
                      onClick={() => window.location.href = "/pricing"}
                      variant="outline" 
                      className="w-full mt-2"
                    >
                      Subscribe to Access
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
