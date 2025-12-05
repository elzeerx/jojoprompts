import React from 'react';
import { Shield, Clock, Sparkles, Award, RefreshCw, Zap } from 'lucide-react';
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
    <section className="mobile-section-padding">
      <Container>
        {/* Header */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className={cn("section-title animate-fade-in", isRTL && "rtl-text")}>
            {t('trustSignals.title')}
            <span className={cn(
              "text-transparent bg-clip-text bg-gradient-to-r from-warm-gold to-muted-teal block sm:inline",
              isRTL ? "sm:mr-3" : "sm:ml-3"
            )}>
              {t('trustSignals.titleHighlight')}
            </span>
          </h2>
          <p className={cn("section-subtitle animate-fade-in delay-200", isRTL && "rtl-text")}>
            {t('trustSignals.subtitle')}
          </p>
        </div>

        {/* Trust Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-12 sm:mb-16">
          {trustFeatures.map((feature, index) => (
            <div 
              key={index}
              className="group bg-white rounded-xl p-6 shadow-md hover:shadow-xl border border-gray-200 hover:border-warm-gold/30 transition-all duration-300 transform hover:-translate-y-1 animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className={cn("flex items-start space-x-4", isRTL && "flex-row-reverse space-x-reverse")}>
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-warm-gold/10 to-muted-teal/10 rounded-lg flex items-center justify-center group-hover:from-warm-gold/20 group-hover:to-muted-teal/20 transition-all duration-300">
                    <feature.icon className="h-6 w-6 text-warm-gold" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className={cn("flex items-center gap-2 mb-2", isRTL && "flex-row-reverse")}>
                    <h3 className={cn("text-lg font-semibold text-dark-base group-hover:text-warm-gold transition-colors", isRTL && "rtl-text")}>
                      {feature.title}
                    </h3>
                    <span className="px-2 py-1 bg-warm-gold/10 text-warm-gold text-xs font-medium rounded-full">
                      {feature.highlight}
                    </span>
                  </div>
                  <p className={cn("text-muted-foreground text-sm leading-relaxed", isRTL && "rtl-text text-right")}>
                    {feature.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Security Badges */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-lg border border-gray-200">
          <div className="text-center mb-6">
            <h3 className={cn("text-xl sm:text-2xl font-bold text-dark-base mb-2", isRTL && "rtl-text")}>
              {t('trustSignals.securityTitle')}
            </h3>
            <p className={cn("text-muted-foreground", isRTL && "rtl-text")}>
              {t('trustSignals.securitySubtitle')}
            </p>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            {securityBadges.map((badge, index) => (
              <div 
                key={index}
                className="flex flex-col items-center p-4 rounded-lg bg-gradient-to-br from-warm-gold/5 to-muted-teal/5 hover:from-warm-gold/10 hover:to-muted-teal/10 transition-all duration-300 group"
              >
                <div className="text-2xl mb-2 group-hover:scale-110 transition-transform duration-300">
                  {badge.icon}
                </div>
                <h4 className={cn("font-semibold text-dark-base text-sm text-center mb-1", isRTL && "rtl-text")}>
                  {badge.name}
                </h4>
                <p className={cn("text-xs text-muted-foreground text-center", isRTL && "rtl-text")}>
                  {badge.description}
                </p>
              </div>
            ))}
          </div>
        </div>

      </Container>
    </section>
  );
}
