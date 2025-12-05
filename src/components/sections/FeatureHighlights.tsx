
import React from 'react';
import { Check, Star, Zap, Book } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

export function FeatureHighlights() {
  const { t, isRTL } = useTranslation();
  
  const features = [
    {
      icon: <Star className="h-5 w-5" />,
      title: t('featureHighlights.feature1Title'),
      description: t('featureHighlights.feature1Description'),
      metric: t('featureHighlights.feature1Metric'),
      metricLabel: t('featureHighlights.feature1MetricLabel')
    },
    {
      icon: <Zap className="h-5 w-5" />,
      title: t('featureHighlights.feature2Title'),
      description: t('featureHighlights.feature2Description'),
      metric: t('featureHighlights.feature2Metric'),
      metricLabel: t('featureHighlights.feature2MetricLabel')
    },
    {
      icon: <Book className="h-5 w-5" />,
      title: t('featureHighlights.feature3Title'),
      description: t('featureHighlights.feature3Description'),
      metric: t('featureHighlights.feature3Metric'),
      metricLabel: t('featureHighlights.feature3MetricLabel')
    },
    {
      icon: <Check className="h-5 w-5" />,
      title: t('featureHighlights.feature4Title'),
      description: t('featureHighlights.feature4Description'),
      metric: t('featureHighlights.feature4Metric'),
      metricLabel: t('featureHighlights.feature4MetricLabel')
    }
  ];

  return (
    <section className="py-20 sm:py-28 bg-white">
      <div className="container max-w-6xl">
        {/* Header */}
        <div className="text-center mb-16 sm:mb-20">
          <h2 className={cn(
            "text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight text-dark-base mb-4",
            isRTL && "rtl-text"
          )}>
            {t('featureHighlights.title')}
            <span className="text-warm-gold font-medium">
              {' '}{t('featureHighlights.titleHighlight')}
            </span>
          </h2>
          <p className={cn(
            "text-muted-foreground text-lg max-w-2xl mx-auto font-light",
            isRTL && "rtl-text"
          )}>
            {t('featureHighlights.subtitle')}
          </p>
        </div>
        
        {/* Feature Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-gray-200 rounded-2xl overflow-hidden">
          {features.map((feature, index) => (
            <div 
              key={index} 
              className="group bg-white p-8 sm:p-10 hover:bg-gray-50/50 transition-colors duration-300"
            >
              {/* Metric - Large and prominent */}
              <div className="mb-6">
                <span className="text-4xl sm:text-5xl font-light text-warm-gold tracking-tight">
                  {feature.metric}
                </span>
                <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">
                  {feature.metricLabel}
                </p>
              </div>
              
              {/* Icon + Title */}
              <div className={cn(
                "flex items-center gap-3 mb-3",
                isRTL && "flex-row-reverse"
              )}>
                <div className="text-warm-gold">
                  {feature.icon}
                </div>
                <h3 className="text-base font-medium text-dark-base">
                  {feature.title}
                </h3>
              </div>
              
              {/* Description */}
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
              
              {/* Subtle hover indicator */}
              <div className="mt-6 h-px bg-gray-200 group-hover:bg-warm-gold/50 transition-colors duration-300" />
            </div>
          ))}
        </div>
        
        {/* Bottom CTA - Minimal */}
        <div className="text-center mt-16">
          <p className={cn(
            "text-muted-foreground text-sm",
            isRTL && "rtl-text"
          )}>
            {t('featureHighlights.ctaQuestion')}
            <span className="text-warm-gold ml-2">
              {t('featureHighlights.ctaMessage')}
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
