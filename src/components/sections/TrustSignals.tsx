import React from 'react';
import { Clock, Sparkles, Award, RefreshCw, Zap } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

export function TrustSignals() {
  const { t, isRTL } = useTranslation();
  
  const trustFeatures = [
    {
      icon: Clock,
      title: t('trustSignals.feature1Title'),
      description: t('trustSignals.feature1Description'),
      highlight: t('trustSignals.feature1Highlight')
    },
    {
      icon: RefreshCw,
      title: t('trustSignals.feature2Title'),
      description: t('trustSignals.feature2Description'),
      highlight: t('trustSignals.feature2Highlight')
    },
    {
      icon: Award,
      title: t('trustSignals.feature3Title'),
      description: t('trustSignals.feature3Description'),
      highlight: t('trustSignals.feature3Highlight')
    },
    {
      icon: Sparkles,
      title: t('trustSignals.feature4Title'),
      description: t('trustSignals.feature4Description'),
      highlight: t('trustSignals.feature4Highlight')
    },
    {
      icon: Zap,
      title: t('trustSignals.feature5Title'),
      description: t('trustSignals.feature5Description'),
      highlight: t('trustSignals.feature5Highlight')
    }
  ];

  const securityBadges = [
    {
      name: t('trustSignals.badge1Name'),
      description: t('trustSignals.badge1Description'),
      icon: "🔒"
    },
    {
      name: t('trustSignals.badge2Name'),
      description: t('trustSignals.badge2Description'),
      icon: "💳"
    },
    {
      name: t('trustSignals.badge3Name'),
      description: t('trustSignals.badge3Description'),
      icon: "🛡️"
    },
    {
      name: t('trustSignals.badge4Name'),
      description: t('trustSignals.badge4Description'),
      icon: "✅"
    }
  ];

  return (
    <section className="mobile-section-padding bg-white">
      <Container>
        {/* Header */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className={cn("section-title", isRTL && "rtl-text")}>
            {t('trustSignals.title')}
            <span className={cn(
              "text-warm-gold block sm:inline",
              isRTL ? "sm:mr-3" : "sm:ml-3"
            )}>
              {t('trustSignals.titleHighlight')}
            </span>
          </h2>
          <p className={cn("section-subtitle", isRTL && "rtl-text")}>
            {t('trustSignals.subtitle')}
          </p>
        </div>

        {/* Trust Features Grid - Minimalist 1px border grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-200 rounded-2xl overflow-hidden mb-12 sm:mb-16">
          {trustFeatures.map((feature, index) => (
            <div 
              key={index}
              className="bg-white p-6 sm:p-8 group hover:bg-gray-50/50 transition-colors duration-200"
            >
              {/* Highlight badge */}
              <span className="text-warm-gold text-xs font-medium uppercase tracking-wide">
                {feature.highlight}
              </span>
              
              {/* Icon + Title row */}
              <div className={cn("flex items-center gap-3 mt-4 mb-3", isRTL && "flex-row-reverse")}>
                <feature.icon className="h-5 w-5 text-warm-gold flex-shrink-0" />
                <h3 className={cn("text-base sm:text-lg font-semibold text-dark-base", isRTL && "rtl-text")}>
                  {feature.title}
                </h3>
              </div>
              
              {/* Description */}
              <p className={cn("text-muted-foreground text-sm leading-relaxed", isRTL && "rtl-text")}>
                {feature.description}
              </p>
              
              {/* Hover indicator line */}
              <div className="h-px bg-gray-100 group-hover:bg-warm-gold/30 transition-colors duration-300 mt-6" />
            </div>
          ))}
        </div>

        {/* Security Badges - Simple inline row */}
        <div className="border-t border-gray-200 pt-8 sm:pt-12">
          <div className="text-center mb-6">
            <h3 className={cn("text-lg font-semibold text-dark-base", isRTL && "rtl-text")}>
              {t('trustSignals.securityTitle')}
            </h3>
          </div>
          
          <div className={cn(
            "flex flex-wrap justify-center items-center gap-6 sm:gap-8",
            isRTL && "flex-row-reverse"
          )}>
            {securityBadges.map((badge, index) => (
              <div 
                key={index}
                className={cn(
                  "flex items-center gap-2 text-muted-foreground",
                  isRTL && "flex-row-reverse"
                )}
              >
                <span className="text-lg">{badge.icon}</span>
                <span className="text-sm font-medium">{badge.name}</span>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
