
import { Check, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

interface PlanCardProps {
  plan: {
    id: string;
    name: string;
    description?: string | null;
    price_usd: number;
    features: string[] | any;
    excluded_features?: string[] | any;
    is_lifetime: boolean;
  };
  isSelected: boolean;
  isPopular?: boolean;
  onSelect: () => void;
}

export function PlanCard({ plan, isSelected, isPopular, onSelect }: PlanCardProps) {
  const { name, description, price_usd, features, excluded_features, is_lifetime } = plan;
  const { t, isRTL } = useTranslation();
  
  return (
    <div 
      className={cn(
        "relative group flex flex-col h-full bg-white p-6 sm:p-8 cursor-pointer transition-colors duration-200",
        isSelected ? "bg-warm-gold/5" : "hover:bg-gray-50/50",
        isPopular && "ring-2 ring-warm-gold bg-warm-gold/5"
      )}
      onClick={onSelect}
    >
      {/* Most Popular Badge */}
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <span className="bg-warm-gold text-white text-xs font-medium px-3 py-1 rounded-full shadow-sm whitespace-nowrap">
            Most Popular
          </span>
        </div>
      )}
      
      {/* Plan Label */}
      <div className={cn("mb-4", isPopular && "mt-2")}>
        <span className={cn(
          "text-xs font-medium text-muted-foreground uppercase tracking-wider",
          isRTL && "rtl-text"
        )}>
          {name}
        </span>
      </div>

      {/* Price */}
      <div className="mb-2">
        <span className="text-4xl sm:text-5xl font-light text-warm-gold">
          ${price_usd}
        </span>
      </div>

      {/* Duration Badge */}
      <div className="mb-4">
        <span className={cn(
          "text-xs text-muted-foreground uppercase tracking-wide",
          isRTL && "rtl-text"
        )}>
          {is_lifetime ? t('pricingSection.lifetimeAccess') : t('pricingSection.yearAccess')}
        </span>
      </div>

      {/* Description */}
      {description && (
        <p className={cn(
          "text-sm text-muted-foreground mb-6",
          isRTL && "rtl-text"
        )}>
          {description}
        </p>
      )}

      {/* Features List */}
      <div className="flex-grow mb-6">
        <ul className="space-y-3">
          {features && features.map((feature: string, index: number) => (
            <li 
              key={`feature-${index}`} 
              className={cn(
                "flex items-start",
                isRTL && "flex-row-reverse"
              )}
            >
              <Check className={cn(
                "h-4 w-4 text-warm-gold flex-shrink-0 mt-0.5",
                isRTL ? "ml-3" : "mr-3"
              )} />
              <span className={cn(
                "text-sm text-foreground",
                isRTL && "rtl-text text-right"
              )}>
                {feature}
              </span>
            </li>
          ))}
          
          {excluded_features && excluded_features.map((feature: string, index: number) => (
            <li 
              key={`excluded-${index}`} 
              className={cn(
                "flex items-start",
                isRTL && "flex-row-reverse"
              )}
            >
              <X className={cn(
                "h-4 w-4 text-muted-foreground/40 flex-shrink-0 mt-0.5",
                isRTL ? "ml-3" : "mr-3"
              )} />
              <span className={cn(
                "text-sm text-muted-foreground/60",
                isRTL && "rtl-text text-right"
              )}>
                {feature}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA Button */}
      <Button
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        className={cn(
          "w-full transition-colors duration-200",
          isSelected 
            ? "bg-warm-gold hover:bg-warm-gold/90 text-white" 
            : "bg-warm-gold hover:bg-warm-gold/90 text-white"
        )}
      >
        <span className={cn("flex items-center justify-center gap-2", isRTL && "flex-row-reverse")}>
          {isSelected ? (
            <>
              <Check className="h-4 w-4" />
              {t('pricingSection.selected')}
            </>
          ) : (
            <>
              {is_lifetime ? t('pricingSection.getLifetimeAccess') : t('pricingSection.getYearAccess')}
              <ArrowRight className={cn("h-4 w-4", isRTL && "rotate-180")} />
            </>
          )}
        </span>
      </Button>

      {/* Subtle hover indicator line */}
      <div className="mt-6 h-px bg-gray-100 group-hover:bg-warm-gold/30 transition-colors duration-200" />
    </div>
  );
}
