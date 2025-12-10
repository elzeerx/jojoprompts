import React from "react";
import { Shield } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface MoneyBackGuaranteeProps {
  days?: number;
  variant?: "default" | "compact";
}

export function MoneyBackGuarantee({ days = 30, variant = "default" }: MoneyBackGuaranteeProps) {
  const { t, isRTL } = useLanguage();

  if (variant === "compact") {
    return (
      <div className={`flex items-center justify-center gap-2 text-sm text-muted-foreground ${isRTL ? 'flex-row-reverse' : ''}`}>
        <Shield className="h-4 w-4 text-green-600" />
        <span>{t('moneyBack.guarantee', { days: String(days) })}</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 p-4 rounded-lg bg-green-50 border border-green-100 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
      <div className="flex-shrink-0 p-2.5 rounded-full bg-green-100">
        <Shield className="h-5 w-5 text-green-600" />
      </div>
      <div>
        <p className="font-medium text-green-800">{t('moneyBack.guarantee', { days: String(days) })}</p>
        <p className="text-sm text-green-600">{t('moneyBack.fullRefund')}</p>
      </div>
    </div>
  );
}
