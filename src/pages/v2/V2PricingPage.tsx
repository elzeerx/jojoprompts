import { Link } from "react-router-dom";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SeoHead } from "@/components/v2/SeoHead";
import { LifetimeUpgradeCard } from "@/components/v2/LifetimeUpgradeCard";
import { useTranslation } from "@/hooks/useTranslation";
import { formatKwd, LIFETIME_THRESHOLD_FILS } from "@/config/v2Flags";

export default function V2PricingPage() {
  const { language, isRTL } = useTranslation();
  const lang = language === "ar" ? "ar" : "en";
  const t = {
    title: lang === "ar" ? "الأسعار" : "Pricing",
    subtitle:
      lang === "ar"
        ? "ادفع مرة واحدة لكل مورد. اجمع ٣٠ د.ك وستُفتح كل موارد جوجو مدى الحياة."
        : "One-time purchases per resource. Reach 30 KD and every Jojo resource unlocks for life.",
    individualTitle: lang === "ar" ? "الموارد الفردية" : "Individual resources",
    individualDesc:
      lang === "ar"
        ? "امتلك المهارات، الأتمتة، البرومبتات، وأنماط الصور بشكل فردي أو ضمن حزم."
        : "Own skills, automations, prompts, and image styles individually or in bundles.",
    from: lang === "ar" ? "تبدأ من" : "From",
    to: lang === "ar" ? "حتى" : "up to",
    browse: lang === "ar" ? "تصفح المتجر" : "Browse the catalog",
    lifetimeTitle: lang === "ar" ? "مدى الحياة — المكتبة الكاملة" : "Full-library Lifetime",
    lifetimePrice: `${formatKwd(LIFETIME_THRESHOLD_FILS)} KD`,
    lifetimeIncludes: lang === "ar" ? "يشمل" : "Includes",
    l1:
      lang === "ar"
        ? "كل موارد جوجو المنشورة الآن ومستقبلاً"
        : "Every current and future published Jojo resource",
    l2:
      lang === "ar"
        ? "تنزيلات الإصدارات الجديدة تلقائياً"
        : "Automatic access to new versions",
    l3:
      lang === "ar"
        ? "تحسب مشترياتك السابقة المؤهلة"
        : "Eligible past purchases count toward the total",
    l4:
      lang === "ar"
        ? "لا تشمل تلقائياً موارد المبدعين المستقلين المستقبلية"
        : "Does not automatically include future independent-creator resources",
  };

  return (
    <div dir={isRTL ? "rtl" : "ltr"}>
      <SeoHead
        title={`${t.title} · JojoPrompts`}
        description={t.subtitle}
        canonicalPath="/pricing"
      />
      <main className="container mx-auto max-w-5xl px-4 py-8 space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-3xl font-bold">{t.title}</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">{t.subtitle}</p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border p-6 space-y-3">
            <Badge variant="outline" className="w-fit">
              {lang === "ar" ? "دفع لمرة واحدة" : "One-time"}
            </Badge>
            <h2 className="text-xl font-semibold">{t.individualTitle}</h2>
            <p className="text-sm text-muted-foreground">{t.individualDesc}</p>
            <div className="text-sm">
              <span className="text-muted-foreground">{t.from}</span>{" "}
              <span className="font-semibold">0.500 KD</span>{" "}
              <span className="text-muted-foreground">{t.to}</span>{" "}
              <span className="font-semibold">10.000 KD</span>
            </div>
            <Button asChild className="min-h-[44px] w-full sm:w-auto">
              <Link to="/explore">{t.browse}</Link>
            </Button>
          </section>

          <section className="rounded-2xl border border-warm-gold/50 bg-warm-gold/10 p-6 space-y-3">
            <Badge className="w-fit gap-1">
              <Sparkles className="h-3 w-3" aria-hidden />
              {lang === "ar" ? "الأفضل قيمة" : "Best value"}
            </Badge>
            <h2 className="text-xl font-semibold">{t.lifetimeTitle}</h2>
            <div className="text-3xl font-bold text-warm-gold">{t.lifetimePrice}</div>
            <div className="text-sm font-medium">{t.lifetimeIncludes}:</div>
            <ul className="space-y-1.5 text-sm">
              {[t.l1, t.l2, t.l3].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-warm-gold" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
              <li className="ms-6 text-xs text-muted-foreground">{t.l4}</li>
            </ul>
            <LifetimeUpgradeCard />
          </section>
        </div>
      </main>
    </div>
  );
}
