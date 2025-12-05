
import { Button } from "@/components/ui/button";
import { FileText, Sparkles, Copy, Download, Zap, Users, Shield, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

export default function AboutPage() {
  const { t, isRTL } = useTranslation();

  return (
    <div className="mobile-container-padding mobile-section-padding max-w-4xl mx-auto pt-20 lg:pt-24">
      <div className="text-center mb-8 sm:mb-12">
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-warm-gold/10 p-3 sm:p-4">
            <FileText className="h-8 w-8 sm:h-10 sm:w-10 text-warm-gold" />
          </div>
        </div>
        <h1 className="section-title mb-4 text-dark-base">{t("about.title")}</h1>
        <p className="section-subtitle max-w-3xl mx-auto leading-relaxed">
          {t("about.subtitle")}
        </p>
      </div>
      
      <div className="mobile-element-spacing">
        <section>
          <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-dark-base text-center">
            {t("about.storyTitle")}
          </h2>
          <div className="bg-warm-gold/5 p-6 sm:p-8 rounded-lg border border-warm-gold/20">
            <p className="text-base sm:text-lg text-muted-foreground mb-4 leading-relaxed">
              {t("about.storyParagraph1")}
            </p>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
              {t("about.storyParagraph2")}
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-dark-base text-center">
            {t("about.specialTitle")}
          </h2>
          <div className="mobile-grid gap-6 sm:gap-8">
            <div className="mobile-card text-center hover:shadow-md transition-shadow">
              <div className="rounded-full bg-warm-gold/10 p-4 mb-4 mx-auto w-fit">
                <Star className="h-6 w-6 text-warm-gold" />
              </div>
              <h3 className="font-semibold text-lg sm:text-xl mb-3 text-dark-base">
                {t("about.qualityTitle")}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {t("about.qualityDesc")}
              </p>
            </div>
            
            <div className="mobile-card text-center hover:shadow-md transition-shadow">
              <div className="rounded-full bg-warm-gold/10 p-4 mb-4 mx-auto w-fit">
                <Users className="h-6 w-6 text-warm-gold" />
              </div>
              <h3 className="font-semibold text-lg sm:text-xl mb-3 text-dark-base">
                {t("about.personalTitle")}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {t("about.personalDesc")}
              </p>
            </div>
            
            <div className="mobile-card text-center hover:shadow-md transition-shadow">
              <div className="rounded-full bg-warm-gold/10 p-4 mb-4 mx-auto w-fit">
                <Sparkles className="h-6 w-6 text-warm-gold" />
              </div>
              <h3 className="font-semibold text-lg sm:text-xl mb-3 text-dark-base">
                {t("about.evolvingTitle")}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {t("about.evolvingDesc")}
              </p>
            </div>
          </div>
        </section>
        
        <section>
          <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-dark-base text-center">
            {t("about.findTitle")}
          </h2>
          <div className="mobile-grid-2 gap-6 sm:gap-8">
            <div className="mobile-card hover:shadow-md transition-shadow">
              <div className={cn(
                "flex items-start",
                isRTL ? "space-x-reverse space-x-4" : "space-x-4"
              )}>
                <div className="rounded-full bg-warm-gold/10 p-3 flex-shrink-0">
                  <Copy className="h-5 w-5 text-warm-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base sm:text-lg mb-2 text-dark-base">
                    {t("about.copyTitle")}
                  </h3>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                    {t("about.copyDesc")}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mobile-card hover:shadow-md transition-shadow">
              <div className={cn(
                "flex items-start",
                isRTL ? "space-x-reverse space-x-4" : "space-x-4"
              )}>
                <div className="rounded-full bg-warm-gold/10 p-3 flex-shrink-0">
                  <Star className="h-5 w-5 text-warm-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base sm:text-lg mb-2 text-dark-base">
                    {t("about.favoritesTitle")}
                  </h3>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                    {t("about.favoritesDesc")}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mobile-card hover:shadow-md transition-shadow">
              <div className={cn(
                "flex items-start",
                isRTL ? "space-x-reverse space-x-4" : "space-x-4"
              )}>
                <div className="rounded-full bg-warm-gold/10 p-3 flex-shrink-0">
                  <Zap className="h-5 w-5 text-warm-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base sm:text-lg mb-2 text-dark-base">
                    {t("about.searchTitle")}
                  </h3>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                    {t("about.searchDesc")}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mobile-card hover:shadow-md transition-shadow">
              <div className={cn(
                "flex items-start",
                isRTL ? "space-x-reverse space-x-4" : "space-x-4"
              )}>
                <div className="rounded-full bg-warm-gold/10 p-3 flex-shrink-0">
                  <Sparkles className="h-5 w-5 text-warm-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base sm:text-lg mb-2 text-dark-base">
                    {t("about.multiPlatformTitle")}
                  </h3>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                    {t("about.multiPlatformDesc")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-warm-gold/5 p-6 sm:p-8 rounded-lg border border-warm-gold/20">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-dark-base text-center">
            {t("about.journeyTitle")}
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground mb-6 sm:mb-8 text-center max-w-3xl mx-auto leading-relaxed">
            {t("about.journeyDesc")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="mobile-button-primary">
              <Link to="/prompts">{t("about.browsePrompts")}</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="mobile-button-secondary">
              <Link to="/pricing">{t("about.joinCommunity")}</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
