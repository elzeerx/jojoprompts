import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowRight, Search, ShieldCheck, ShoppingBag, DownloadCloud, LibraryBig } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

/**
 * Dedicated public /how-it-works page. Bilingual EN/AR, mobile-first,
 * 44px touch targets. Explains browse → sign in / acquire / pay →
 * permanent entitlement → inspect files → download / update. No
 * creator marketplace claims.
 */
export default function HowItWorksPage() {
  const { language, isRTL } = useTranslation();
  const lang: "en" | "ar" = language === "ar" ? "ar" : "en";
  const t = copy(lang);

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="bg-background text-foreground">
      <Helmet>
        <title>{t.seoTitle}</title>
        <meta name="description" content={t.seoDesc} />
        <link rel="canonical" href="https://jojoprompts.lovable.app/how-it-works" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={t.seoTitle} />
        <meta property="og:description" content={t.seoDesc} />
        <meta property="og:url" content="https://jojoprompts.lovable.app/how-it-works" />
      </Helmet>

      <section className="border-b border-border/60 bg-gradient-to-b from-warm-gold/10 to-transparent">
        <div className="container mx-auto max-w-4xl px-4 py-12 sm:py-16">
          <h1 className="text-3xl font-bold sm:text-4xl">{t.title}</h1>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">
            {t.subtitle}
          </p>
        </div>
      </section>

      <section className="container mx-auto max-w-4xl px-4 py-10">
        <ol className="space-y-4">
          {[
            { n: "1", icon: Search, label: t.s1, desc: t.s1Desc },
            { n: "2", icon: ShoppingBag, label: t.s2, desc: t.s2Desc },
            { n: "3", icon: LibraryBig, label: t.s3, desc: t.s3Desc },
            { n: "4", icon: ShieldCheck, label: t.s4, desc: t.s4Desc },
            { n: "5", icon: DownloadCloud, label: t.s5, desc: t.s5Desc },
          ].map((s) => (
            <li key={s.n} className="rounded-2xl border p-5">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-warm-gold text-sm font-bold text-dark-base">
                  {s.n}
                </span>
                <s.icon className="h-5 w-5 text-warm-gold" aria-hidden />
                <h2 className="text-lg font-semibold">{s.label}</h2>
              </div>
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">{s.desc}</p>
            </li>
          ))}
        </ol>

        <div className="mt-8 rounded-2xl border border-warm-gold/40 bg-warm-gold/5 p-5">
          <h2 className="text-lg font-semibold">{t.ownTitle}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-muted-foreground rtl:pl-0 rtl:pr-6 sm:text-base">
            <li>{t.own1}</li>
            <li>{t.own2}</li>
            <li>{t.own3}</li>
          </ul>
        </div>

        <div className={cn("mt-8 flex flex-wrap gap-3", isRTL && "flex-row-reverse")}>
          <Button asChild className="min-h-[44px] bg-warm-gold text-dark-base hover:bg-warm-gold/90">
            <Link to="/explore" className="inline-flex items-center gap-2">
              {t.ctaPrimary}
              <ArrowRight className={cn("h-4 w-4", isRTL && "rotate-180")} aria-hidden />
            </Link>
          </Button>
          <Button asChild variant="outline" className="min-h-[44px]">
            <Link to="/pricing">{t.ctaSecondary}</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

function copy(lang: "en" | "ar") {
  if (lang === "ar") {
    return {
      seoTitle: "كيف يعمل JojoPrompts — تصفّح، امتلك، ثبِّت، حدِّث",
      seoDesc:
        "تصفّح الموارد، سجّل واشترِ، احصل على استحقاق دائم في مكتبتك، تحقّق من الأذونات وتنزّل الحزم.",
      title: "كيف يعمل",
      subtitle:
        "من التصفّح حتى التنزيل — كل خطوة صريحة. مدفوعات لمرة واحدة، ملكية دائمة، ولا ادعاءات سوقٍ للمبدعين.",
      s1: "تصفّح",
      s1Desc:
        "استعرض المهارات والأتمتة والبرومبتات وأنماط الصور والحزم بحسب المنصّة، السعر، والجهد.",
      s2: "سجّل الدخول واشترِ",
      s2Desc:
        "سجّل الدخول، ادفع مرة واحدة لكل مورد أو افتح المكتبة الكاملة مدى الحياة عند بلوغ الحد.",
      s3: "استحقاق دائم في مكتبتك",
      s3Desc:
        "المشتريات تُضاف فوراً إلى /library وتبقى دائماً — بلا اشتراك وبلا انتهاء.",
      s4: "تحقّق من الملفات والأذونات",
      s4Desc:
        "افحص حالة أمن الحزمة، الاعتماديات، الأذونات، رقم الإصدار، وبصمة SHA-256 قبل الاستخدام.",
      s5: "نزّل، ثبّت، وحدِّث",
      s5Desc:
        "اتبع دليل التثبيت الخاص بمنصّتك ونزّل التحديثات الجديدة بحسب الإصدار الرئيسي المشمول.",
      ownTitle: "قواعد الملكية والمدى الحياتي",
      own1: "ادفع مرة واحدة لكل مورد.",
      own2: "كل عملية شراء مؤهّلة تُحتسب ضمن حدّ 30.000 د.ك للمكتبة الكاملة مدى الحياة.",
      own3: "منتجات المبدعين المستقلين المستقبلية غير مشمولة تلقائياً في المكتبة الكاملة مدى الحياة.",
      ctaPrimary: "ابدأ من المتجر",
      ctaSecondary: "افتح الأسعار",
    };
  }
  return {
    seoTitle: "How JojoPrompts works — browse, own, install, update",
    seoDesc:
      "Browse resources, sign in and acquire, get permanent library access, verify permissions, and download packages.",
    title: "How it works",
    subtitle:
      "From browsing to download — every step is explicit. One-time payments, permanent ownership, and no creator-marketplace claims.",
    s1: "Browse",
    s1Desc:
      "Filter skills, automations, prompts, image styles, and bundles by platform, price, and effort.",
    s2: "Sign in & acquire",
    s2Desc:
      "Sign in, pay once per resource, or unlock the Full Library Lifetime when you cross the threshold.",
    s3: "Permanent entitlement in your library",
    s3Desc:
      "Purchases land in /library instantly and stay there permanently — no subscription, no expiry.",
    s4: "Inspect files & permissions",
    s4Desc:
      "Review the package scan status, dependencies, permissions, version, and SHA-256 checksum before using it.",
    s5: "Download, install, and update",
    s5Desc:
      "Follow the platform-specific install guide, and download new updates within the eligible major version.",
    ownTitle: "Ownership & lifetime rules",
    own1: "One-time payment per resource.",
    own2: "Every eligible Jojo purchase counts toward the 30.000 KD Full Library Lifetime threshold.",
    own3:
      "Future independent-creator products are not automatically included in Full Library Lifetime.",
    ctaPrimary: "Start from the catalog",
    ctaSecondary: "Open pricing",
  };
}
