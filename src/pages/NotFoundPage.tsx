import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Compass, Home, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { createLogger } from "@/utils/logging";

const logger = createLogger("NOT_FOUND_PAGE");

interface Copy {
  eyebrow: string;
  title: string;
  lead: string;
  detail: string;
  explore: string;
  home: string;
  contact: string;
  code: string;
}

const COPY: Record<"en" | "ar", Copy> = {
  en: {
    eyebrow: "404",
    title: "This page has moved or no longer exists",
    lead:
      "The link you followed didn't match anything in the JojoPrompts marketplace.",
    detail:
      "Head back to discovery to browse skills, automations, prompts, image styles and bundles — or reach out and we'll help you find what you were looking for.",
    explore: "Browse the marketplace",
    home: "Go to home",
    contact: "Contact support",
    code: "Error code",
  },
  ar: {
    eyebrow: "٤٠٤",
    title: "هذه الصفحة انتقلت أو لم تعد موجودة",
    lead: "الرابط الذي فتحته لا يطابق أي محتوى في متجر JojoPrompts.",
    detail:
      "عد إلى الاستكشاف لتصفح المهارات والأتمتة والموجهات وأنماط الصور والحزم — أو تواصل معنا وسنساعدك في العثور على ما تبحث عنه.",
    explore: "تصفح المتجر",
    home: "الصفحة الرئيسية",
    contact: "تواصل مع الدعم",
    code: "رمز الخطأ",
  },
};

/**
 * V2 marketplace 404 — bilingual EN/AR, RTL-aware, reduced-motion safe,
 * 44px touch targets, no legacy prompt copy and no floating Add Prompt
 * shortcut. Rendered inside V2Layout via the top-level wildcard route.
 */
export default function NotFoundPage() {
  const { language, isRTL, t } = useLanguage();
  const location = useLocation();
  const lang: "en" | "ar" = language === "ar" ? "ar" : "en";
  const copy = COPY[lang];

  useEffect(() => {
    logger.error("404 Error: Non-existent route accessed", {
      path: location.pathname,
    });
  }, [location.pathname]);

  // `t()` may resolve project translation keys when present; fall back to
  // the inline dictionary otherwise so this page renders correctly even
  // without dedicated translation entries.
  const resolve = (key: string, fallback: string): string => {
    try {
      const value = t(key);
      return value && value !== key ? value : fallback;
    } catch {
      return fallback;
    }
  };

  return (
    <section
      dir={isRTL ? "rtl" : "ltr"}
      className="mx-auto flex min-h-[calc(100vh-16rem)] w-full max-w-3xl flex-col items-center justify-center gap-8 px-4 py-16 text-center sm:py-24"
      aria-labelledby="notfound-title"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-24 -z-10 flex justify-center motion-safe:animate-pulse motion-reduce:animate-none"
        aria-hidden="true"
      >
        <div className="h-40 w-40 rounded-full bg-warm-gold/10 blur-3xl sm:h-64 sm:w-64" />
      </div>

      <p className="text-sm font-medium uppercase tracking-[0.35em] text-muted-foreground">
        {resolve("notFound.eyebrow", copy.eyebrow)}
        <span className="mx-2 text-warm-gold" aria-hidden="true">
          ·
        </span>
        {resolve("notFound.codeLabel", copy.code)} 404
      </p>

      <h1
        id="notfound-title"
        className="text-balance text-3xl font-semibold leading-tight text-dark-base sm:text-5xl"
      >
        {resolve("notFound.title", copy.title)}
      </h1>

      <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
        {resolve("notFound.lead", copy.lead)}
      </p>
      <p className="max-w-xl text-sm text-muted-foreground/90 sm:text-base">
        {resolve("notFound.detail", copy.detail)}
      </p>

      <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
        <Button
          asChild
          size="lg"
          className="min-h-[44px] min-w-[44px] focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          <Link to="/explore" aria-label={resolve("notFound.explore", copy.explore)}>
            <Compass className="h-4 w-4" aria-hidden="true" />
            <span>{resolve("notFound.explore", copy.explore)}</span>
          </Link>
        </Button>

        <Button
          asChild
          size="lg"
          variant="outline"
          className="min-h-[44px] min-w-[44px] focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          <Link to="/" aria-label={resolve("notFound.home", copy.home)}>
            <Home className="h-4 w-4" aria-hidden="true" />
            <span>{resolve("notFound.home", copy.home)}</span>
          </Link>
        </Button>

        <Button
          asChild
          size="lg"
          variant="ghost"
          className="min-h-[44px] min-w-[44px] focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          <Link to="/contact" aria-label={resolve("notFound.contact", copy.contact)}>
            <LifeBuoy className="h-4 w-4" aria-hidden="true" />
            <span>{resolve("notFound.contact", copy.contact)}</span>
          </Link>
        </Button>
      </div>
    </section>
  );
}
