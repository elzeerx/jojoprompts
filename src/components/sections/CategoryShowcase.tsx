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
  
  const activeCategories = categories.filter(category => category.is_active);

  if (loading) {
    return (
      <section className="mobile-section-padding bg-white">
        <div className="container">
          <div className="text-center">
            <div className={cn("text-muted-foreground", isRTL && "rtl-text")}>{t('categoryShowcase.loading')}</div>
          </div>
        </div>
      </section>
    );
  }

  if (activeCategories.length === 0) {
    return (
      <section className="mobile-section-padding bg-white">
        <div className="container">
          <div className="text-center">
            <p className={cn("text-muted-foreground", isRTL && "rtl-text")}>{t('categoryShowcase.noCategories')}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mobile-section-padding bg-gray-50">
      <div className="container">
        {/* Header */}
        <div className="text-center mb-12 sm:mb-16 mobile-container-padding">
          <h2 className={cn("section-title", isRTL && "rtl-text")}>
            {t('categoryShowcase.title')}
            <span className={cn(
              "text-warm-gold block sm:inline",
              isRTL ? "sm:mr-3" : "sm:ml-3"
            )}>
              {t('categoryShowcase.titleHighlight')}
            </span>
          </h2>
          <p className={cn("section-subtitle", isRTL && "rtl-text")}>
            {t('categoryShowcase.subtitle')}
          </p>
        </div>
        
        {/* Categories List */}
        <div className="space-y-6 sm:space-y-8">
          {activeCategories.map((category, index) => {
            const IconComponent = iconMap[category.icon_name as keyof typeof iconMap] || Sparkles;
            const isReversed = !isMobile && index % 2 === 1;
            
            return (
              <div 
                key={category.id} 
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden"
              >
                <div className={cn(
                  "flex flex-col lg:flex-row",
                  isReversed && "lg:flex-row-reverse"
                )}>
                  {/* Image Section */}
                  <div className="lg:w-2/5 relative">
                    {category.image_path ? (
                      <img 
                        src={category.image_path} 
                        alt={category.name} 
                        className="w-full h-56 sm:h-64 lg:h-full object-cover" 
                      />
                    ) : (
                      <div className="w-full h-56 sm:h-64 lg:h-full bg-gray-100 flex items-center justify-center">
                        <IconComponent className="h-16 w-16 text-gray-300" />
                      </div>
                    )}
                    {/* Plan Badge */}
                    <div className="absolute top-4 right-4">
                      <span className="bg-white text-dark-base text-xs font-medium px-3 py-1.5 rounded-full border border-gray-200 capitalize">
                        {category.required_plan}
                      </span>
                    </div>
                  </div>

                  {/* Content Section */}
                  <div className="lg:w-3/5 p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
                    <div className={cn("flex items-center gap-3 mb-4", isRTL && "flex-row-reverse")}>
                      <IconComponent className="h-5 w-5 text-warm-gold" />
                      <h3 className={cn(
                        "text-xl sm:text-2xl font-semibold text-dark-base",
                        isRTL && "rtl-text"
                      )}>
                        {category.name}
                      </h3>
                    </div>
                    
                    <p className={cn(
                      "text-muted-foreground leading-relaxed mb-6",
                      isRTL && "rtl-text"
                    )}>
                      {category.description}
                    </p>
                    
                    {/* Features - Simple inline */}
                    {category.features && category.features.length > 0 && (
                      <div className={cn("flex flex-wrap gap-x-4 gap-y-2 mb-6", isRTL && "flex-row-reverse")}>
                        {category.features.map((feature, featureIndex) => (
                          <span 
                            key={featureIndex}
                            className={cn("flex items-center gap-2 text-sm text-muted-foreground", isRTL && "flex-row-reverse")}
                          >
                            <span className="w-1 h-1 bg-warm-gold rounded-full" />
                            {feature}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* CTA */}
                    <div className={cn(isRTL && "text-right")}>
                      {user ? (
                        <Link 
                          to={category.link_path}
                          className={cn(
                            "inline-flex items-center gap-2 text-warm-gold font-medium hover:text-warm-gold/80 transition-colors",
                            isRTL && "flex-row-reverse"
                          )}
                        >
                          <span>{t('categoryShowcase.exploreCollection')}</span>
                          <ArrowRight className={cn("h-4 w-4", isRTL && "rotate-180")} />
                        </Link>
                      ) : (
                        <div className={cn("flex items-center gap-4", isRTL && "flex-row-reverse")}>
                          <div className={cn(
                            "flex items-center gap-2 text-muted-foreground text-sm",
                            isRTL && "flex-row-reverse"
                          )}>
                            <Lock className="h-3.5 w-3.5" />
                            <span className="capitalize text-warm-gold font-medium">{category.required_plan}</span>
                            <span>{t('categoryShowcase.planRequired')}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA - Simple */}
        <div className="text-center mt-12 sm:mt-16 mobile-container-padding">
          <div className="bg-white rounded-2xl border border-gray-200 p-8 sm:p-10 lg:p-12 max-w-3xl mx-auto">
            <h3 className={cn("text-xl sm:text-2xl font-semibold text-dark-base mb-3", isRTL && "rtl-text")}>
              {t('categoryShowcase.finalCtaTitle')}
            </h3>
            <p className={cn("text-muted-foreground mb-6", isRTL && "rtl-text")}>
              {t('categoryShowcase.finalCtaSubtitle')}
            </p>
            <Button 
              onClick={() => window.location.href = "/pricing"}
              size={isMobile ? "default" : "lg"}
              className="bg-warm-gold hover:bg-warm-gold/90 text-white font-semibold px-8"
            >
              <Zap className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
              {t('categoryShowcase.finalCtaButton')}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
