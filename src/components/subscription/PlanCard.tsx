
import { Check, X } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PlanCardProps {
  plan: {
    id: string;
    name: string;
    description: string;
    price_usd: number;
    price_kwd: number;
    features: string[];
    excluded_features: string[];
    is_lifetime: boolean;
  };
  isSelected: boolean;
  onSelect: () => void;
}

export function PlanCard({ plan, isSelected, onSelect }: PlanCardProps) {
  const { name, description, price_usd, price_kwd, features, excluded_features } = plan;
  
  return (
    <Card className={`flex flex-col h-full transition-all ${
      isSelected 
        ? 'ring-2 ring-warm-gold border-warm-gold transform scale-[1.02]' 
        : ''
    }`}>
      <CardHeader className="pb-3">
        <div className="text-center">
          <h3 className="text-xl font-bold">{name}</h3>
          <div className="mt-2 flex items-baseline justify-center">
            <span className="text-3xl font-bold text-warm-gold">${price_usd}</span>
            <span className="ml-1 text-sm text-gray-500">({price_kwd} KWD)</span>
          </div>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
      </CardHeader>
      
      <CardContent className="flex-grow">
        <ul className="space-y-2">
          {features.map((feature, index) => (
            <li key={`feature-${index}`} className="flex items-start">
              <Check className="h-5 w-5 text-warm-gold mr-2 flex-shrink-0 mt-0.5" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
          
          {excluded_features.map((feature, index) => (
            <li key={`excluded-${index}`} className="flex items-start text-muted-foreground">
              <X className="h-5 w-5 text-muted-foreground/50 mr-2 flex-shrink-0 mt-0.5" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      
      <CardFooter className="pt-4">
        <Button
          onClick={onSelect}
          className="w-full"
          variant={isSelected ? "default" : "outline"}
        >
          {isSelected ? "Selected" : "Select"}
        </Button>
      </CardFooter>
    </Card>
  );
}
