import React from "react";
import { Shield, Lock, CreditCard, CheckCircle, Award } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface EnhancedTrustBadgesProps {
  variant?: "horizontal" | "vertical" | "compact";
  showPayPalProtection?: boolean;
}

export function EnhancedTrustBadges({ 
  variant = "horizontal", 
  showPayPalProtection = true 
}: EnhancedTrustBadgesProps) {
  const { t, isRTL } = useLanguage();

  const badges = [
    {
      icon: Shield,
      label: "PayPal Buyer Protection",
      sublabel: "Shop with confidence",
      show: showPayPalProtection,
    },
    {
      icon: Lock,
      label: "256-bit SSL",
      sublabel: "Secure encryption",
      show: true,
    },
    {
      icon: CreditCard,
      label: "Secure Payment",
      sublabel: "Protected checkout",
      show: true,
    },
    {
      icon: Award,
      label: "Satisfaction Guaranteed",
      sublabel: "Quality assured",
      show: true,
    },
  ].filter(badge => badge.show);

  if (variant === "compact") {
    return (
      <div className={`flex items-center justify-center gap-4 text-muted-foreground ${isRTL ? 'flex-row-reverse' : ''}`}>
        {badges.slice(0, 3).map((badge, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <badge.icon className="h-4 w-4 text-green-600" />
            <span className="text-xs">{badge.label}</span>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "vertical") {
    return (
      <div className="space-y-3">
        {badges.map((badge, index) => (
          <div 
            key={index} 
            className={`flex items-center gap-3 p-3 rounded-lg bg-green-50/50 border border-green-100 ${isRTL ? 'flex-row-reverse text-right' : ''}`}
          >
            <div className="flex-shrink-0 p-2 rounded-full bg-green-100">
              <badge.icon className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{badge.label}</p>
              <p className="text-xs text-muted-foreground">{badge.sublabel}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Horizontal (default)
  return (
    <div className={`flex flex-wrap items-center justify-center gap-4 sm:gap-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
      {badges.map((badge, index) => (
        <div 
          key={index} 
          className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
        >
          <div className="p-1.5 rounded-full bg-green-100">
            <badge.icon className="h-3.5 w-3.5 text-green-600" />
          </div>
          <div className={isRTL ? 'text-right' : ''}>
            <p className="text-xs font-medium text-foreground leading-tight">{badge.label}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{badge.sublabel}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
