
import { Button } from "@/components/ui/button";
import { FileText, Sparkles, Copy, Zap, Users, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

export default function AboutPage() {
  const { t, isRTL } = useTranslation();

  const specialFeatures = [
    { icon: Star, titleKey: "about.qualityTitle", descKey: "about.qualityDesc" },
    { icon: Users, titleKey: "about.personalTitle", descKey: "about.personalDesc" },
    { icon: Sparkles, titleKey: "about.evolvingTitle", descKey: "about.evolvingDesc" },
  ];

  const findFeatures = [
    { icon: Copy, titleKey: "about.copyTitle", descKey: "about.copyDesc" },
    { icon: Star, titleKey: "about.favoritesTitle", descKey: "about.favoritesDesc" },
    { icon: Zap, titleKey: "about.searchTitle", descKey: "about.searchDesc" },
    { icon: Sparkles, titleKey: "about.multiPlatformTitle", descKey: "about.multiPlatformDesc" },
  ];

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
        
        {/* Hero Section */}
        <div className="text-center mb-12 sm:mb-16">
          <FileText className="h-8 w-8 sm:h-10 sm:w-10 text-warm-gold mx-auto mb-4" />
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight text-dark-base mb-4">
            {t("about.title")}
          </h1>
          <p className="text-lg text-muted-foreground font-light max-w-2xl mx-auto">
            {t("about.subtitle")}
          </p>
        </div>
        
        {/* Our Story Section */}
        <section className="mb-12 sm:mb-16">
          <h2 className={cn(
            "text-2xl sm:text-3xl font-light tracking-tight text-dark-base mb-6 sm:mb-8 text-center",
            isRTL && "text-right"
          )}>
            {t("about.storyTitle")}
          </h2>
          <div className="grid gap-px bg-gray-200 rounded-2xl overflow-hidden">
            <div className="bg-white p-6 sm:p-8">
              <p className="text-base sm:text-lg text-muted-foreground mb-4 leading-relaxed font-light">
                {t("about.storyParagraph1")}
              </p>
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed font-light">
                {t("about.storyParagraph2")}
              </p>
            </div>
          </div>
        </section>

        {/* Special Features Section */}
        <section className="mb-12 sm:mb-16">
          <h2 className={cn(
            "text-2xl sm:text-3xl font-light tracking-tight text-dark-base mb-6 sm:mb-8 text-center",
            isRTL && "text-right"
          )}>
            {t("about.specialTitle")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-gray-200 rounded-2xl overflow-hidden">
            {specialFeatures.map((feature, index) => (
              <div key={index} className="bg-white p-6 sm:p-8 group hover:bg-gray-50/50 transition-colors duration-300 text-center relative">
                <feature.icon className="h-6 w-6 text-warm-gold mx-auto mb-4" />
                <h3 className="font-medium text-lg mb-3 text-dark-base">
                  {t(feature.titleKey)}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed font-light">
                  {t(feature.descKey)}
                </p>
                {/* Accent line */}
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-100 group-hover:bg-warm-gold/30 transition-colors duration-300" />
              </div>
            ))}
          </div>
        </section>
        
        {/* Find Your Prompt Section */}
        <section className="mb-12 sm:mb-16">
          <h2 className={cn(
            "text-2xl sm:text-3xl font-light tracking-tight text-dark-base mb-6 sm:mb-8 text-center",
            isRTL && "text-right"
          )}>
            {t("about.findTitle")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-gray-200 rounded-2xl overflow-hidden">
            {findFeatures.map((feature, index) => (
              <div key={index} className="bg-white p-6 sm:p-8 group hover:bg-gray-50/50 transition-colors duration-300 relative">
                <div className={cn(
                  "flex items-start gap-4",
                  isRTL && "flex-row-reverse"
                )}>
                  <feature.icon className="h-5 w-5 text-warm-gold flex-shrink-0 mt-1" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-base sm:text-lg mb-2 text-dark-base">
                      {t(feature.titleKey)}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed font-light">
                      {t(feature.descKey)}
                    </p>
                  </div>
                </div>
                {/* Accent line */}
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-100 group-hover:bg-warm-gold/30 transition-colors duration-300" />
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section>
          <div className="grid gap-px bg-gray-200 rounded-2xl overflow-hidden">
            <div className="bg-white p-8 sm:p-12 text-center group hover:bg-gray-50/50 transition-colors duration-300 relative">
              <h2 className="text-2xl sm:text-3xl font-light tracking-tight text-dark-base mb-4">
                {t("about.journeyTitle")}
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground mb-8 max-w-2xl mx-auto font-light leading-relaxed">
                {t("about.journeyDesc")}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" className="bg-warm-gold hover:bg-warm-gold/90 text-white">
                  <Link to="/prompts">{t("about.browsePrompts")}</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="border-gray-200 hover:bg-gray-50 text-dark-base">
                  <Link to="/pricing">{t("about.joinCommunity")}</Link>
                </Button>
              </div>
              {/* Accent line */}
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-100 group-hover:bg-warm-gold/30 transition-colors duration-300" />
            </div>
          </div>
        </section>
        
      </div>
    </div>
  );
}
