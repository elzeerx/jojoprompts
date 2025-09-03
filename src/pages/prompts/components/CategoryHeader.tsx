import React from "react";
import { getCategoryTheme } from "@/components/ui/prompt-card/utils/categoryUtils";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface CategoryHeaderProps {
  category: string;
  promptCount?: number;
}

export function CategoryHeader({ category, promptCount }: CategoryHeaderProps) {
  const theme = getCategoryTheme(category);
  const IconComponent = theme.icon;

  if (category === "All") {
    return (
      <div className="relative overflow-hidden bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10 border-b border-border/50">
        <div className="container py-8 sm:py-12">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2">
                All Prompts
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base mb-4">
                Discover our complete collection of AI prompts
              </p>
              {promptCount !== undefined && (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                  {promptCount} prompts available
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-gradient-to-r ${theme.gradient} border-b border-border/50`}>
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      <div className="container py-8 sm:py-12 relative">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="flex-shrink-0">
            <div 
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ backgroundColor: theme.color }}
            >
              <IconComponent className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
            </div>
          </div>
          
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2">
              {category} Prompts
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base mb-4">
              {theme.tagline}
            </p>
            
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start mb-4">
              {theme.features.map((feature, index) => (
                <div
                  key={index}
                  className="px-3 py-1 bg-background/80 backdrop-blur-sm text-foreground rounded-full text-xs font-medium border border-border/50"
                >
                  {feature}
                </div>
              ))}
            </div>
            
            {promptCount !== undefined && (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-background/80 backdrop-blur-sm text-foreground rounded-full text-sm font-medium border border-border/50">
                {promptCount} prompts available
              </div>
            )}
          </div>
          
          <div className="flex-shrink-0">
            <Button
              variant="secondary"
              className="bg-background/80 backdrop-blur-sm hover:bg-background/90 border border-border/50"
            >
              Explore All
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}