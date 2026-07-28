import { Link } from "react-router-dom";
import { SeoHead } from "@/components/v2/SeoHead";
import {
  ArrowRight,
  Search,
  ShoppingBag,
  ShieldCheck,
  DownloadCloud,
  Sparkles,
  Wand2,
  Workflow,
  ImageIcon,
  Package,
  BookOpenCheck,
  Infinity as InfinityIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { V2_PLATFORMS } from "@/config/v2Flags";
import { V2_PRICING_TIERS, V2_LIFETIME_PRICE_KD } from "@/config/v2Pricing";
import { useLatestPublishedResources } from "@/hooks/v2/useLatestPublishedResources";
import { useLibraryState } from "@/hooks/v2/useLibraryState";
import { VisualResourceCard } from "@/components/v2/VisualResourceCard";
import { SkillResourceCard } from "@/components/v2/SkillResourceCard";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

/**
 * V2 public homepage. Skills-first messaging covering Jojo-owned skills,
 * automations, prompts, image styles, and bundles. All CTAs point at real
 * routes — no `#pricing` hash targets. Bilingual EN/AR with correct RTL.
 */
export default function HomePage() {
  const { language, isRTL } = useTranslation();
  const lang: "en" | "ar" = language === "ar" ? "ar" : "en";

  const t = pageCopy(lang);

  return (
    <main dir={isRTL ? "rtl" : "ltr"} className="bg-background text-foreground">
      <SeoHead
        title={t.seoTitle}
        description={t.seoDesc}
        canonicalPath="/"
      />

      {/* Hero */}
      <section className="border-b border-border/60 bg-gradient-to-b from-warm-gold/10 to-transparent">
        <div className="container mx-auto max-w-5xl px-4 py-12 sm:py-16 lg:py-20">
          <Badge className="mb-4 bg-warm-gold text-dark-base hover:bg-warm-gold/90">
            {t.heroBadge}
          </Badge>
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            {t.heroTitle}
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            {t.heroSubtitle}
          </p>
          <div className={cn("mt-6 flex flex-wrap gap-3", isRTL && "flex-row-reverse")}>
            <Button
              asChild
              size="lg"
              className="min-h-[44px] bg-warm-gold text-dark-base hover:bg-warm-gold/90"
            >
              <Link to="/explore" className="inline-flex items-center gap-2">
                {t.heroCtaPrimary}
                <ArrowRight className={cn("h-4 w-4", isRTL && "rotate-180")} aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="min-h-[44px]">
              <Link to="/how-it-works">{t.heroCtaSecondary}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Category cards */}
      <section aria-labelledby="cats-heading" className="border-b border-border/60">
        <div className="container mx-auto max-w-6xl px-4 py-12">
          <h2 id="cats-heading" className="text-2xl font-bold sm:text-3xl">
            {t.catsTitle}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            {t.catsSubtitle}
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { to: "/skills", icon: Wand2, label: t.catSkills, desc: t.catSkillsDesc },
              { to: "/automations", icon: Workflow, label: t.catAutomations, desc: t.catAutomationsDesc },
              { to: "/prompts", icon: Sparkles, label: t.catPrompts, desc: t.catPromptsDesc },
              { to: "/image-styles", icon: ImageIcon, label: t.catImageStyles, desc: t.catImageStylesDesc },
              { to: "/bundles", icon: Package, label: t.catBundles, desc: t.catBundlesDesc },
              { to: "/explore", icon: Search, label: t.catExplore, desc: t.catExploreDesc },
            ].map((c) => (
              <Link
                key={c.to}
                to={c.to}
                className="group min-h-[44px] rounded-2xl border p-5 transition-colors hover:border-warm-gold hover:bg-warm-gold/5"
                data-testid="home-category-card"
              >
                <c.icon className="h-6 w-6 text-warm-gold" aria-hidden />
                <div className="mt-2 text-lg font-semibold">{c.label}</div>
                <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Live catalog */}
      <LiveCatalog lang={lang} isRTL={isRTL} />

      {/* Platform compatibility */}
      <section aria-labelledby="plat-heading" className="border-b border-border/60 bg-muted/30">
        <div className="container mx-auto max-w-6xl px-4 py-12">
          <h2 id="plat-heading" className="text-2xl font-bold sm:text-3xl">
            {t.platTitle}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            {t.platSubtitle}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {V2_PLATFORMS.map((p) => (
              <Badge key={p} variant="outline" className="min-h-[32px] px-3 py-1 text-sm capitalize">
                {p === "generic" ? (lang === "ar" ? "عام / يدوي" : "Generic / manual") : p}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {/* Trust / installation */}
      <section aria-labelledby="trust-heading" className="border-b border-border/60">
        <div className="container mx-auto max-w-6xl px-4 py-12">
          <h2 id="trust-heading" className="text-2xl font-bold sm:text-3xl">
            {t.trustTitle}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            {t.trustSubtitle}
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: ShieldCheck, label: t.trust1, desc: t.trust1Desc },
              { icon: BookOpenCheck, label: t.trust2, desc: t.trust2Desc },
              { icon: DownloadCloud, label: t.trust3, desc: t.trust3Desc },
            ].map((c) => (
              <div key={c.label} className="rounded-2xl border p-5">
                <c.icon className="h-6 w-6 text-warm-gold" aria-hidden />
                <div className="mt-2 text-lg font-semibold">{c.label}</div>
                <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* One-time pricing / lifetime */}
      <section
        aria-labelledby="price-heading"
        className="border-b border-border/60 bg-warm-gold/5"
      >
        <div className="container mx-auto max-w-6xl px-4 py-12">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <h2 id="price-heading" className="text-2xl font-bold sm:text-3xl">
                {t.priceTitle}
              </h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
                {t.priceSubtitle}
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                {V2_PRICING_TIERS.slice(0, 6).map((tier) => (
                  <li
                    key={tier.key}
                    className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/40 py-2"
                  >
                    <span>{tier[lang].name}</span>
                    <span className="font-semibold text-warm-gold">{tier.price}</span>
                  </li>
                ))}
              </ul>
              <div className={cn("mt-6 flex flex-wrap gap-3", isRTL && "flex-row-reverse")}>
                <Button asChild className="min-h-[44px] bg-warm-gold text-dark-base hover:bg-warm-gold/90">
                  <Link to="/pricing">{t.priceCtaPrimary}</Link>
                </Button>
                <Button asChild variant="outline" className="min-h-[44px]">
                  <Link to="/explore">{t.priceCtaSecondary}</Link>
                </Button>
              </div>
            </div>
            <div className="rounded-2xl border border-warm-gold/50 bg-background p-6">
              <div className="flex items-center gap-2">
                <InfinityIcon className="h-5 w-5 text-warm-gold" aria-hidden />
                <h3 className="text-xl font-semibold">{t.lifetimeTitle}</h3>
              </div>
              <div className="mt-2 text-3xl font-bold text-warm-gold">
                {V2_LIFETIME_PRICE_KD}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{t.lifetimeDesc}</p>
              <p className="mt-3 text-xs text-muted-foreground">{t.lifetimeExclusion}</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works — inline overview */}
      <section
        id="how-it-works"
        aria-labelledby="how-heading"
        className="border-b border-border/60"
      >
        <div className="container mx-auto max-w-6xl px-4 py-12">
          <h2 id="how-heading" className="text-2xl font-bold sm:text-3xl">
            {t.howTitle}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            {t.howSubtitle}
          </p>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { n: "1", icon: Search, label: t.how1, desc: t.how1Desc },
              { n: "2", icon: ShoppingBag, label: t.how2, desc: t.how2Desc },
              { n: "3", icon: ShieldCheck, label: t.how3, desc: t.how3Desc },
              { n: "4", icon: DownloadCloud, label: t.how4, desc: t.how4Desc },
            ].map((s) => (
              <li key={s.n} className="rounded-2xl border p-5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-warm-gold text-sm font-bold text-dark-base">
                    {s.n}
                  </span>
                  <s.icon className="h-5 w-5 text-warm-gold" aria-hidden />
                </div>
                <div className="mt-2 text-base font-semibold">{s.label}</div>
                <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
              </li>
            ))}
          </ol>
          <div className={cn("mt-6", isRTL && "text-right")}>
            <Button asChild variant="outline" className="min-h-[44px]">
              <Link to="/how-it-works">{t.howCta}</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}

function LiveCatalog({ lang, isRTL }: { lang: "en" | "ar"; isRTL: boolean }) {
  const { user } = useAuth();
  const {
    data: library,
    isPending: isLibraryPending,
    isError: isLibraryError,
    refetch: refetchLibrary,
  } = useLibraryState();
  const {
    data,
    isPending,
    isError,
    refetch,
    fetchStatus,
  } =
    useLatestPublishedResources(6);
  const isLoading =
    (isPending && fetchStatus !== "idle") || (!!user && isLibraryPending);
  const hasError = isError || (!!user && isLibraryError);
  const ownedResourceIds = new Set(
    (library?.entitlements ?? [])
      .filter((entitlement) => entitlement.scope === "resource" && entitlement.resource_id)
      .map((entitlement) => entitlement.resource_id as string),
  );
  const rows = (data ?? []).map((resource) => {
    const ownedViaLibrary = !!library?.has_library_access;
    const ownedIndividually = ownedResourceIds.has(resource.id);
    return {
      ...resource,
      owned: ownedViaLibrary || ownedIndividually,
      ownedVia: ownedViaLibrary
        ? ("library" as const)
        : ownedIndividually
          ? ("resource" as const)
          : null,
    };
  });


  const t = {
    title: lang === "ar" ? "أحدث الموارد المنشورة" : "Latest published resources",
    subtitle:
      lang === "ar"
        ? "معاينة حقيقية من المتجر — لا محتوى وهمي."
        : "A live look from the catalog — no placeholder content.",
    error: lang === "ar" ? "تعذّر تحميل المتجر." : "Couldn't load the catalog.",
    retry: lang === "ar" ? "إعادة المحاولة" : "Retry",
    empty:
      lang === "ar"
        ? "لا توجد موارد منشورة بعد."
        : "No published resources yet.",
    all: lang === "ar" ? "استكشف الكل" : "Explore all",
  };

  return (
    <section aria-labelledby="live-heading" className="border-b border-border/60">
      <div className="container mx-auto max-w-6xl px-4 py-12">
        <div className={cn("flex flex-wrap items-end justify-between gap-3", isRTL && "flex-row-reverse")}>
          <div>
            <h2 id="live-heading" className="text-2xl font-bold sm:text-3xl">
              {t.title}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">{t.subtitle}</p>
          </div>
          <Button asChild variant="outline" className="min-h-[44px]">
            <Link to="/explore">{t.all}</Link>
          </Button>
        </div>

        <div className="mt-6" data-testid="home-live-catalog">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-2xl" />
              ))}
            </div>
          ) : hasError ? (
            <div
              data-testid="home-live-error"
              className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive"
            >
              <p>{t.error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 min-h-[44px]"
                onClick={() => {
                  void refetch();
                  if (user) void refetchLibrary();
                }}
              >
                {t.retry}
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <div data-testid="home-live-empty" className="rounded-2xl border p-8 text-center text-sm text-muted-foreground">
              {t.empty}
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((r) => (
                <li key={r.id}>
                  {r.type === "prompt" || r.type === "image_style" ? (
                    <VisualResourceCard r={r} />
                  ) : (
                    <SkillResourceCard r={r} />
                  )}
                </li>
              ))}
            </ul>
          )}

        </div>
      </div>
    </section>
  );
}

function pageCopy(lang: "en" | "ar") {
  if (lang === "ar") {
    return {
      seoTitle: "JojoPrompts — مهارات، أتمتة، برومبتات وأنماط ذكاء اصطناعي",
      seoDesc:
        "منصة جوجو للذكاء الاصطناعي: مهارات موثّقة، أتمتة، برومبتات، أنماط صور وحزم. ادفع مرة واحدة، امتلك مدى الحياة.",
      heroBadge: "مهارات جوجو الأصلية",
      heroTitle: "مهارات وأتمتة وبرومبتات وأنماط صور — تمتلكها للأبد.",
      heroSubtitle:
        "موارد ذكاء اصطناعي جاهزة من صنع جوجو: مهارات، أتمتة/سير عمل، برومبتات، أنماط صور، وحزم — تُشترى مرة واحدة وتبقى في مكتبتك دائماً.",
      heroCtaPrimary: "استكشف المتجر",
      heroCtaSecondary: "كيف يعمل",
      catsTitle: "فئات الموارد",
      catsSubtitle: "تصفّح ما نصنعه — من المهارات إلى الحزم — واعرف بالضبط ما ستمتلكه.",
      catSkills: "المهارات",
      catSkillsDesc: "إعدادات مهارات جاهزة لمساعدك المفضّل.",
      catAutomations: "الأتمتة",
      catAutomationsDesc: "سيَر عمل وأتمتة متكاملة قابلة للتشغيل.",
      catPrompts: "البرومبتات",
      catPromptsDesc: "برومبتات فردية وحزم منسّقة.",
      catImageStyles: "أنماط الصور",
      catImageStylesDesc: "أنماط صور جاهزة لتوليد نتائج متسقة.",
      catBundles: "الحزم",
      catBundlesDesc: "مجموعات موارد منسّقة بثمن أفضل.",
      catExplore: "استكشف الكل",
      catExploreDesc: "تصفح كل الموارد المنشورة في مكان واحد.",
      platTitle: "متوافقة مع منصّاتك",
      platSubtitle:
        "موارد جوجو تدعم Claude وChatGPT وCodex وGemini وHermes وKimi، وخيار عام/يدوي للاستخدام في أي أداة.",
      trustTitle: "ثقة وتثبيت شفّاف",
      trustSubtitle:
        "كل مورد يمرّ عبر فحص أمني وموثّق بالإصدارات والتحقق. تثبيت واضح لكل منصّة.",
      trust1: "فحص أمني للحِزم",
      trust1Desc:
        "الحزم تُفحص ضد الفيروسات وتُعرض حالة الفحص، مع أذونات ومتطلّبات واضحة.",
      trust2: "إصدارات وتحقّق سلامة",
      trust2Desc: "أرقام إصدارات وبصمات SHA-256 لكل ملف يمكن تنزيله.",
      trust3: "مكتبة دائمة",
      trust3Desc:
        "كل مورد اشتريته يبقى في مكتبتك للأبد — بلا اشتراك وبلا انتهاء.",
      priceTitle: "دفع لمرة واحدة، ملكية دائمة",
      priceSubtitle:
        "دفعات فردية بالدينار الكويتي لكل مورد. كل عملية شراء مؤهّلة تُحتسب ضمن حدّ المكتبة الكاملة مدى الحياة.",
      priceCtaPrimary: "افتح صفحة الأسعار",
      priceCtaSecondary: "تصفّح المتجر",
      lifetimeTitle: "المكتبة الكاملة — مدى الحياة",
      lifetimeDesc:
        "افتح كل موارد جوجو المنشورة الآن ومستقبلاً. مدفوعات فردية سابقة مؤهّلة تُخصم من هذا الحدّ.",
      lifetimeExclusion:
        "ملاحظة: منتجات المبدعين المستقلين المستقبلية غير مشمولة تلقائياً في المكتبة الكاملة مدى الحياة.",
      howTitle: "كيف يعمل",
      howSubtitle:
        "من التصفّح حتى التنزيل — كل خطوة صريحة، بدون اشتراكات ولا ادعاءات سوقٍ للمبدعين.",
      how1: "تصفّح",
      how1Desc: "استعرض الموارد المنشورة عبر الفلاتر والفئات.",
      how2: "سجّل واشترِ",
      how2Desc: "سجّل الدخول، اشترِ المورد أو المكتبة الكاملة بدفعة واحدة.",
      how3: "افحص وتحقّق",
      how3Desc: "اطّلع على الأذونات، الاعتماديات، البصمة، ودليل التثبيت.",
      how4: "نزّل واستخدم",
      how4Desc: "نزّل المورد وأدخله في المنصّة التي تناسبك — يبقى في مكتبتك.",
      howCta: "افتح دليل «كيف يعمل»",
    };
  }
  return {
    seoTitle: "JojoPrompts — AI skills, automations, prompts & image styles",
    seoDesc:
      "Jojo's AI marketplace: verified skills, automations, prompts, image styles, and bundles. One-time payment, permanent library.",
    heroBadge: "Original Jojo skills",
    heroTitle: "AI skills, automations, prompts & image styles — yours forever.",
    heroSubtitle:
      "Ready-made AI resources made by Jojo: skills, automations/workflows, prompts, image styles, and bundles. Buy once and keep them permanently in your library.",
    heroCtaPrimary: "Browse the catalog",
    heroCtaSecondary: "How it works",
    catsTitle: "Resource categories",
    catsSubtitle: "See exactly what you get — from single skills to full bundles.",
    catSkills: "Skills",
    catSkillsDesc: "Ready-made skill configurations for your favorite assistant.",
    catAutomations: "Automations",
    catAutomationsDesc: "End-to-end automations and workflows you can run.",
    catPrompts: "Prompts",
    catPromptsDesc: "Individual prompts and curated prompt packs.",
    catImageStyles: "Image styles",
    catImageStylesDesc: "Consistent, reusable image-generation styles.",
    catBundles: "Bundles",
    catBundlesDesc: "Curated multi-resource bundles at a better price.",
    catExplore: "Explore all",
    catExploreDesc: "Browse every published resource in one place.",
    platTitle: "Compatible with your platforms",
    platSubtitle:
      "Jojo resources cover Claude, ChatGPT, Codex, Gemini, Hermes, Kimi and a generic/manual path for any other tool.",
    trustTitle: "Trust & transparent installation",
    trustSubtitle:
      "Every resource goes through a package scan and versioning path, with clear install guidance per platform.",
    trust1: "Package virus scans",
    trust1Desc:
      "Package downloads run through a virus scanner. Permissions and dependencies are surfaced up front.",
    trust2: "Versions & checksums",
    trust2Desc:
      "Numbered versions and SHA-256 checksums on every downloadable file.",
    trust3: "Permanent library access",
    trust3Desc:
      "Everything you acquire stays in your library — no subscription, no expiry.",
    priceTitle: "One-time pricing. Permanent ownership.",
    priceSubtitle:
      "Individual KWD payments per resource. Every eligible Jojo purchase counts toward the Full Library Lifetime unlock.",
    priceCtaPrimary: "Open pricing",
    priceCtaSecondary: "Browse the catalog",
    lifetimeTitle: "Full Library Lifetime",
    lifetimeDesc:
      "Unlock every current and future published Jojo resource. Eligible past one-time purchases count toward this threshold.",
    lifetimeExclusion:
      "Note: future independent-creator products are not automatically included in Jojo Full Library Lifetime.",
    howTitle: "How it works",
    howSubtitle:
      "From browsing to download — every step is explicit. No subscriptions and no creator-marketplace claims.",
    how1: "Browse",
    how1Desc: "Filter published resources by category, platform, price, and effort.",
    how2: "Sign in & acquire",
    how2Desc: "Sign in, pay once per resource or unlock the Full Library Lifetime.",
    how3: "Inspect & verify",
    how3Desc: "Review permissions, dependencies, checksum, and platform install guide.",
    how4: "Download & install",
    how4Desc:
      "Download the resource and install it on your platform — it stays in your permanent library.",
    howCta: "Open the full How-it-works guide",
  };
}
