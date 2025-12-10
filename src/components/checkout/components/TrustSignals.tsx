import { Lock, Shield, CreditCard, Award } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface TrustSignalsProps {
  variant?: "default" | "minimal";
}

export function TrustSignals({ variant = "default" }: TrustSignalsProps) {
  const { t, isRTL } = useLanguage();

  const badges = [
    {
      icon: Shield,
      label: t('trustBadges.paypalProtection'),
    },
    {
      icon: Lock,
      label: t('trustBadges.sslEncryption'),
    },
    {
      icon: CreditCard,
      label: t('trustBadges.securePayment'),
    },
    {
      icon: Award,
      label: t('trustBadges.satisfactionGuaranteed'),
    },
  ];

  if (variant === "minimal") {
    return (
      <div className={`flex items-center justify-center gap-4 text-xs text-muted-foreground ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Lock className="h-3 w-3" />
          <span>{t('trustBadges.secure')}</span>
        </div>
        <div className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Shield className="h-3 w-3" />
          <span>{t('trustBadges.protected')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground ${isRTL ? 'flex-row-reverse' : ''}`}>
      {badges.map((badge, index) => (
        <div key={index} className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <badge.icon className="h-3.5 w-3.5 text-green-600" />
          <span>{badge.label}</span>
        </div>
      ))}
    </div>
  );
}
