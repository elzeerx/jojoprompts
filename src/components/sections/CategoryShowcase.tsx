
import React from 'react';
import { ArrowRight, Lock, Sparkles, Zap, Workflow, Image, Video, Music, Code, Palette, Bot, Brain, Cpu, Database } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from "@/contexts/AuthContext";
import { Button } from '@/components/ui/button';
import { useCategories } from "@/hooks/useCategories";
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

const iconMap = {
  Sparkles,
  Zap,
  Workflow,
  Image,
  Video,
  Music,
  Code,
  Palette,
  Bot,
  Brain,
  Cpu,
  Database,
};

export function CategoryShowcase() {
  const { user } = useAuth();
  const { categories, loading } = useCategories();
  const isMobile = useIsMobile();
  const { t, isRTL } = useTranslation();
  
  // Filter only active categories for public display
  const activeCategories = categories.filter(category => category.is_active);

  if (loading) {
    return (
      <section className="mobile-section-padding overflow-hidden">
        <div className="container">
          <div className="text-center">
            <div className={cn("animate-pulse text-lg", isRTL && "rtl-text")}>{t('categoryShowcase.loading')}</div>
          </div>
        </div>
      </section>
    );
  }

  if (activeCategories.length === 0) {
    return (
      <section className="mobile-section-padding overflow-hidden">
        <div className="container">
          <div className="text-center">
            <p className={cn("text-muted-foreground text-base sm:text-lg", isRTL && "rtl-text")}>{t('categoryShowcase.noCategories')}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mobile-section-padding overflow-hidden">
      <div className="container relative">
        {/* Animated background elements - Optimized for mobile */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-12 -right-12 sm:-top-24 sm:-right-24 w-48 h-48 sm:w-96 sm:h-96 bg-warm-gold/5 rounded-full animate-pulse"></div>
          <div className="absolute -bottom-12 -left-12 sm:-bottom-24 sm:-left-24 w-40 h-40 sm:w-80 sm:h-80 bg-muted-teal/5 rounded-full animate-pulse delay-1000"></div>
        </div>

        {/* Header - Mobile optimized */}
        <div className="text-center mb-12 sm:mb-16 relative z-10 mobile-container-padding">
          <h2 className={cn("section-title animate-fade-in", isRTL && "rtl-text")}>
            {t('categoryShowcase.title')}
            <span className={cn(
              "text-transparent bg-clip-text bg-gradient-to-r from-warm-gold to-muted-teal block sm:inline",
              isRTL ? "sm:mr-3" : "sm:ml-3"
            )}>
              {t('categoryShowcase.titleHighlight')}
            </span>
          </h2>
          <p className={cn("section-subtitle animate-fade-in delay-200", isRTL && "rtl-text")}>
            {t('categoryShowcase.subtitle')}
          </p>
        </div>
        
        {/* Dynamic Categories Layout - Mobile-first */}
        <div className="space-y-12 sm:space-y-16 lg:space-y-24 relative z-10">
          {activeCategories.map((category, index) => {
            const IconComponent = iconMap[category.icon_name as keyof typeof iconMap] || Sparkles;
            const isReversed = !isMobile && index % 2 === 1;
            
            return (
              <div 
                key={category.id} 
                className={cn(
                  "flex flex-col items-center gap-8 sm:gap-12 lg:gap-16 group",
                  !isMobile && (isReversed ? "lg:flex-row-reverse" : "lg:flex-row")
                )}
              >
                {/* Image Section - Mobile optimized */}
                <div className="flex-1 relative w-full">
                  <div className={`relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br ${category.bg_gradient} p-4 sm:p-6 lg:p-8 transform transition-all duration-700 group-hover:scale-105 ${isMobile ? '' : 'group-hover:rotate-1'}`}>
                    <div className="relative">
                      {category.image_path ? (
                        <img 
                          src={category.image_path} 
                          alt={category.name} 
                          className="w-full h-60 sm:h-72 lg:h-80 object-cover rounded-xl sm:rounded-2xl shadow-xl transition-all duration-500 group-hover:shadow-2xl" 
                        />
                      ) : (
                        <div className="w-full h-60 sm:h-72 lg:h-80 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl sm:rounded-2xl shadow-xl flex items-center justify-center">
                          <IconComponent className="h-16 w-16 sm:h-20 sm:w-20 lg:h-24 lg:w-24 text-gray-400" />
                        </div>
                      )}
                      {/* Plan Badge - Mobile optimized */}
                      <div className="absolute top-2 right-2 sm:top-4 sm:right-4">
                        <span className="bg-white/90 backdrop-blur-sm text-dark-base text-xs sm:text-sm font-bold px-2 py-1 sm:px-3 sm:py-2 rounded-full shadow-lg capitalize animate-bounce">
                          {category.required_plan} Plan
                        </span>
                      </div>
                    </div>
                    
                    {/* Floating Icon - Mobile optimized */}
                    <div className="absolute -top-3 -left-3 sm:-top-6 sm:-left-6 bg-white rounded-full p-2 sm:p-4 shadow-xl border-2 sm:border-4 border-warm-gold/20 transform rotate-12 group-hover:rotate-0 transition-transform duration-500">
                      <IconComponent className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-warm-gold" />
                    </div>
                  </div>
                </div>

                {/* Content Section - Mobile optimized */}
                <div className="flex-1 space-y-4 sm:space-y-6 w-full mobile-container-padding lg:px-0">
                  <div className="space-y-3 sm:space-y-4">
                    <h3 className={cn(
                      "text-2xl sm:text-3xl lg:text-4xl font-bold text-dark-base group-hover:text-warm-gold transition-colors duration-300",
                      isRTL ? "text-center lg:text-right rtl-text" : "text-center lg:text-left"
                    )}>
                      {category.name}
                    </h3>
                    <p className={cn(
                      "text-base sm:text-lg text-muted-foreground leading-relaxed",
                      isRTL ? "text-center lg:text-right rtl-text" : "text-center lg:text-left"
                    )}>
                      {category.description}
                    </p>
                  </div>
                  
                  {/* Feature Grid - Mobile optimized */}
                  {category.features && category.features.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      {category.features.map((feature, featureIndex) => (
                        <div 
                          key={featureIndex}
                          className="flex items-center space-x-2 sm:space-x-3 bg-white/60 backdrop-blur-sm px-3 py-2 sm:px-4 sm:py-3 rounded-lg border border-warm-gold/10 transform hover:scale-105 transition-transform duration-200 touch-manipulation"
                        >
                          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-warm-gold rounded-full animate-pulse flex-shrink-0"></div>
                          <span className="text-xs sm:text-sm font-medium text-dark-base">{feature}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* CTA Section - Mobile optimized */}
                  <div className={cn("pt-2 sm:pt-4", isRTL ? "text-center lg:text-right" : "text-center lg:text-left")}>
                    {user ? (
                      <Link 
                        to={category.link_path}
                        className={cn(
                          "inline-flex items-center space-x-2 sm:space-x-3 text-warm-gold font-bold text-base sm:text-lg hover:text-warm-gold/80 transition-all duration-300 group/link touch-manipulation py-2",
                          isRTL && "flex-row-reverse space-x-reverse"
                        )}
                      >
                        <span>{t('categoryShowcase.exploreCollection')}</span>
                        <ArrowRight className={cn("h-4 w-4 sm:h-5 sm:w-5 transition-transform", isRTL ? "group-hover/link:-translate-x-2 rotate-180" : "group-hover/link:translate-x-2")} />
                      </Link>
                    ) : (
                      <div className="space-y-3 sm:space-y-4">
                        <div className={cn(
                          "flex items-center space-x-2 text-muted-foreground",
                          isRTL ? "justify-center lg:justify-end flex-row-reverse space-x-reverse rtl-text" : "justify-center lg:justify-start"
                        )}>
                          <Lock className="h-3 w-3 sm:h-4 sm:w-4" />
                          <span className="text-xs sm:text-sm">
                            <span className="font-bold capitalize text-warm-gold">{category.required_plan}</span> {t('categoryShowcase.planRequired')}
                          </span>
                        </div>
                        <Button 
                          onClick={() => window.location.href = "/pricing"}
                          size={isMobile ? "default" : "lg"}
                          className="mobile-button-primary bg-gradient-to-r from-warm-gold to-muted-teal hover:from-warm-gold/90 hover:to-muted-teal/90 text-white font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
                        >
                          <Sparkles className={cn("h-4 w-4 sm:h-5 sm:w-5", isRTL ? "ml-2" : "mr-2")} />
                          {t('categoryShowcase.subscribeButton')}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA - Mobile optimized */}
        <div className="text-center mt-16 sm:mt-20 relative z-10 mobile-container-padding">
          <div className="bg-gradient-to-r from-warm-gold/10 via-transparent to-muted-teal/10 rounded-2xl sm:rounded-3xl p-6 sm:p-8 lg:p-12 backdrop-blur-sm border border-warm-gold/20">
            <h3 className={cn("text-xl sm:text-2xl lg:text-3xl font-bold text-dark-base mb-3 sm:mb-4", isRTL && "rtl-text")}>
              {t('categoryShowcase.finalCtaTitle')}
            </h3>
            <p className={cn("text-base sm:text-lg text-muted-foreground mb-6 sm:mb-8 max-w-2xl mx-auto", isRTL && "rtl-text")}>
              {t('categoryShowcase.finalCtaSubtitle')}
            </p>
            <Button 
              onClick={() => window.location.href = "/pricing"}
              size={isMobile ? "default" : "lg"}
              className="mobile-button-primary bg-gradient-to-r from-warm-gold to-muted-teal hover:from-warm-gold/90 hover:to-muted-teal/90 text-white font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
            >
              <Zap className={cn("h-4 w-4 sm:h-5 sm:w-5", isRTL ? "ml-2" : "mr-2")} />
              {t('categoryShowcase.finalCtaButton')}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
