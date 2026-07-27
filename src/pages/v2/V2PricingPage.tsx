import { Link } from "react-router-dom";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SeoHead } from "@/components/v2/SeoHead";
import { LifetimeUpgradeCard } from "@/components/v2/LifetimeUpgradeCard";
import { useTranslation } from "@/hooks/useTranslation";

import { V2_PRICING_TIERS, V2_LIFETIME_PRICE_KD } from "@/config/v2Pricing";
export { V2_PRICING_TIERS, V2_LIFETIME_PRICE_KD };

export default function V2PricingPage() {
  const { language, isRTL } = useTranslation();
  const lang: "en" | "ar" = language === "ar" ? "ar" : "en";

  const t = {
    title: lang === "ar" ? "الأسعار" : "Pricing",
    subtitle:
      lang === "ar"
        ? "ادفع مرة واحدة لكل مورد. كل عملية شراء مؤهّلة تُحسب ضمن حدّ 30.000 د.ك لفتح المكتبة الكاملة مدى الحياة."
        : "One-time payments per resource. Every eligible purchase counts toward the 30.000 KD Full Library Lifetime unlock.",
    oneTime: lang === "ar" ? "دفع لمرة واحدة" : "One-time payment",
    browse: lang === "ar" ? "تصفح المتجر" : "Browse the catalog",
    lifetimeTitle:
      lang === "ar" ? "المكتبة الكاملة — مدى الحياة" : "Full Library Lifetime",
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
        ? "تُحتسب مشترياتك السابقة المؤهلة"
        : "Eligible past purchases count toward the total",
    bestValue: lang === "ar" ? "الأفضل قيمة" : "Best value",
    contract:
      lang === "ar"
        ? "دفعات فردية لمرة واحدة. لا اشتراكات ولا رسوم متكررة."
        : "One-time payments only. No subscriptions, no recurring fees.",
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
          <p className="text-sm text-warm-gold">{t.contract}</p>
        </header>

        <section
          className="grid gap-4 md:grid-cols-2"
          aria-label={lang === "ar" ? "أسعار الموارد" : "Resource pricing"}
        >
          {V2_PRICING_TIERS.map((tier) => (
            <article
              key={tier.key}
              className="rounded-2xl border p-6 space-y-3 flex flex-col"
              data-testid={`pricing-tier-${tier.key}`}
            >
              <Badge variant="outline" className="w-fit">
                {t.oneTime}
              </Badge>
              <h2 className="text-lg font-semibold break-words">
                {tier[lang].name}
              </h2>
              <p className="text-sm text-muted-foreground">{tier[lang].desc}</p>
              <div className="text-2xl font-bold text-warm-gold break-words">
                {tier.price}
              </div>
            </article>
          ))}
        </section>

        <section
          className="rounded-2xl border border-warm-gold/50 bg-warm-gold/10 p-6 space-y-4"
          data-testid="pricing-tier-lifetime"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="gap-1">
              <Sparkles className="h-3 w-3" aria-hidden />
              {t.bestValue}
            </Badge>
            <h2 className="text-xl font-semibold">{t.lifetimeTitle}</h2>
          </div>
          <div className="text-3xl font-bold text-warm-gold">{V2_LIFETIME_PRICE_KD}</div>
          <div className="text-sm font-medium">{t.lifetimeIncludes}:</div>
          <ul className="space-y-1.5 text-sm">
            {[t.l1, t.l2, t.l3].map((line) => (
              <li key={line} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-warm-gold" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <LifetimeUpgradeCard />
        </section>

        <div className="text-center">
          <Button asChild className="min-h-[44px]">
            <Link to="/explore">{t.browse}</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
