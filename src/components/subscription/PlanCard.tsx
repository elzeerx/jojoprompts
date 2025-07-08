
import { Check, X } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PlanCardProps {
  plan: {
    id: string;
    name: string;
    description: string;
    price_usd: number;
    features: string[];
    excluded_features: string[];
    is_lifetime: boolean;
  };
  isSelected: boolean;
  onSelect: () => void;
}

export function PlanCard({ plan, isSelected, onSelect }: PlanCardProps) {
  const { name, description, price_usd, features, excluded_features, is_lifetime } = plan;
  
  return (
    <Card className={`group flex flex-col h-full transition-all duration-500 hover:shadow-2xl hover:shadow-warm-gold/20 hover:-translate-y-2 cursor-pointer ${
      isSelected 
        ? 'ring-2 ring-warm-gold border-warm-gold transform scale-[1.02] shadow-xl shadow-warm-gold/30' 
        : 'hover:ring-2 hover:ring-warm-gold/50 hover:border-warm-gold/50'
    } relative overflow-hidden`}
    onClick={onSelect}>
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-warm-gold/5 via-transparent to-muted-teal/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      
      {/* Floating orbs animation */}
      <div className="absolute top-4 right-4 w-2 h-2 bg-warm-gold/30 rounded-full animate-pulse opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
      <div className="absolute bottom-6 left-4 w-1.5 h-1.5 bg-muted-teal/40 rounded-full animate-pulse opacity-0 group-hover:opacity-100 transition-opacity duration-700" style={{ animationDelay: '0.3s' }}></div>
      
      <CardHeader className="pb-3 relative z-10">
        <div className="text-center">
          <h3 className="text-xl font-bold group-hover:text-warm-gold transition-colors duration-300">{name}</h3>
          <div className="mt-2 flex items-baseline justify-center">
            <span className="text-3xl font-bold text-warm-gold group-hover:scale-110 transition-transform duration-300">${price_usd}</span>
          </div>
          <div className="mt-1">
            {is_lifetime ? (
              <span className="text-sm text-green-600 font-medium group-hover:text-green-500 transition-colors duration-300 inline-flex items-center gap-1">
                ✨ Lifetime Access
              </span>
            ) : (
              <span className="text-sm text-amber-600 font-medium group-hover:text-amber-500 transition-colors duration-300 inline-flex items-center gap-1">
                ⏰ 1 Year Access
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground group-hover:text-foreground/80 transition-colors duration-300">{description}</p>
        </div>
      </CardHeader>
      
      <CardContent className="flex-grow px-4 py-3 relative z-10">
        <ul className="space-y-2">
          {features && features.map((feature, index) => (
            <li key={`feature-${index}`} className="flex items-start group-hover:translate-x-1 transition-transform duration-300" style={{ transitionDelay: `${index * 50}ms` }}>
              <Check className="h-5 w-5 text-warm-gold mr-2 flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform duration-300" />
              <span className="text-sm group-hover:text-foreground transition-colors duration-300">{feature}</span>
            </li>
          ))}
          
          {excluded_features && excluded_features.map((feature, index) => (
            <li key={`excluded-${index}`} className="flex items-start text-muted-foreground group-hover:translate-x-1 transition-transform duration-300" style={{ transitionDelay: `${(features?.length || 0 + index) * 50}ms` }}>
              <X className="h-5 w-5 text-muted-foreground/50 mr-2 flex-shrink-0 mt-0.5" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      
      <CardFooter className="pt-4 px-4 py-4 relative z-10">
        <Button
          onClick={onSelect}
          className={`w-full group-hover:scale-105 transition-all duration-300 ${
            isSelected 
              ? 'bg-warm-gold hover:bg-warm-gold/90 shadow-lg shadow-warm-gold/30' 
              : 'hover:bg-warm-gold hover:text-white hover:border-warm-gold group-hover:shadow-lg group-hover:shadow-warm-gold/20'
          }`}
          variant={isSelected ? "default" : "outline"}
        >
          {isSelected ? (
            <span className="flex items-center gap-2">
              ✓ Selected
            </span>
          ) : (
            <span className="flex items-center gap-2">
              {`Get ${is_lifetime ? "Lifetime" : "1-Year"} Access`}
              <span className="group-hover:translate-x-1 transition-transform duration-300">→</span>
            </span>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
