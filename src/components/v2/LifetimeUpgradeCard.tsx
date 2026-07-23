import { Link } from "react-router-dom";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LifetimeProgress } from "./LifetimeProgress";
import { useLibraryState } from "@/hooks/v2/useLibraryState";
import { useLifetimeProduct } from "@/hooks/v2/useLifetimeProduct";
import { useCart } from "@/hooks/v2/useCart";
import { useTranslation } from "@/hooks/useTranslation";
import { formatKwd, LIFETIME_THRESHOLD_FILS } from "@/config/v2Flags";
import { toast } from "@/hooks/use-toast";

/**
 * Reusable lifetime purchase card. Server-derived credit only; no client math
 * for the charge (server picks the price from the active lifetime product).
 */
export function LifetimeUpgradeCard() {
  const { data: library, isLoading } = useLibraryState();
  const { data: product } = useLifetimeProduct();
  const { language } = useTranslation();
  const cart = useCart();
  const lang = language === "ar" ? "ar" : "en";

  const t = {
    title: lang === "ar" ? "وصول مدى الحياة" : "Lifetime access",
    activeTitle: lang === "ar" ? "مدى الحياة مفعّل" : "Lifetime is active",
    activeDesc:
      lang === "ar"
        ? "كل موارد جوجو المنشورة الآن ومستقبلاً ضمن مكتبتك."
        : "Every current and future Jojo resource is in your library.",
    remaining: lang === "ar" ? "المتبقي" : "Remaining",
    progressCap:
      lang === "ar"
        ? "أنفق ٣٠ د.ك على موارد جوجو المؤهلة وسيُفتح مدى الحياة تلقائياً."
        : "Spend 30 KD on eligible Jojo resources and Lifetime unlocks automatically.",
    creators:
      lang === "ar"
        ? "الموارد المستقبلية من المبدعين المستقلين ليست ضمن مدى الحياة تلقائياً."
        : "Future independent-creator resources are not automatically included in Lifetime.",
    payRemaining: lang === "ar" ? "ادفع المتبقي وأكمل مدى الحياة" : "Pay remaining and unlock Lifetime",
    upgrade: lang === "ar" ? "ترقية مدى الحياة" : "Add lifetime upgrade",
    inCart: lang === "ar" ? "موجود في السلة" : "In your cart",
    viewCart: lang === "ar" ? "عرض السلة" : "View cart",
    unavailable:
      lang === "ar"
        ? "مدى الحياة غير متاح حالياً — سيعود قريباً."
        : "Lifetime is temporarily unavailable — check back soon.",
    signInFirst: lang === "ar" ? "سجّل الدخول لعرض تقدمك." : "Sign in to see your progress.",
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t.title}
        </div>
      </div>
    );
  }

  // Not signed in — informational only.
  if (!library) {
    return (
      <div className="rounded-2xl border border-warm-gold/40 bg-warm-gold/5 p-4 space-y-3">
        <div className="flex items-center gap-2 font-semibold">
          <Sparkles className="h-4 w-4 text-warm-gold" aria-hidden />
          {t.title}
        </div>
        <p className="text-sm text-muted-foreground">{t.progressCap}</p>
        <p className="text-xs text-muted-foreground">{t.signInFirst}</p>
      </div>
    );
  }

  if (library.has_library_access) {
    return (
      <div className="rounded-2xl border border-warm-gold/50 bg-warm-gold/10 p-4 space-y-2">
        <div className="flex items-center gap-2 font-semibold">
          <Sparkles className="h-4 w-4 text-warm-gold" aria-hidden />
          {t.activeTitle}
        </div>
        <p className="text-sm text-muted-foreground">{t.activeDesc}</p>
      </div>
    );
  }

  const remaining = library.lifetime_remaining_fils;
  const inCart = product ? cart.has(product.id) : false;

  const handleAdd = () => {
    if (!product) return;
    cart.add({
      product_id: product.id,
      snapshot: {
        title_en: "Full-Library Lifetime",
        title_ar: "مدى الحياة — المكتبة الكاملة",
        resource_type: null,
        product_type: "lifetime",
      },
    });
    toast({
      title: lang === "ar" ? "أُضيفت مدى الحياة إلى السلة" : "Lifetime added to cart",
    });
  };

  return (
    <div className="rounded-2xl border border-warm-gold/40 bg-warm-gold/5 p-4 space-y-3">
      <div className="flex items-center gap-2 font-semibold">
        <Sparkles className="h-4 w-4 text-warm-gold" aria-hidden />
        {t.title}
      </div>
      <LifetimeProgress progressFils={library.lifetime_progress_fils} />
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{t.remaining}</span>
        <span className="font-semibold text-foreground">
          {formatKwd(remaining)} / {formatKwd(LIFETIME_THRESHOLD_FILS)} KD
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{t.progressCap}</p>
      <p className="text-[11px] text-muted-foreground">{t.creators}</p>
      {product ? (
        inCart ? (
          <Button asChild variant="outline" className="w-full min-h-[44px]">
            <Link to="/cart">{t.viewCart}</Link>
          </Button>
        ) : (
          <Button onClick={handleAdd} className="w-full min-h-[44px]">
            {remaining > 0 && remaining < LIFETIME_THRESHOLD_FILS ? t.payRemaining : t.upgrade}
          </Button>
        )
      ) : (
        <p className="text-xs text-muted-foreground">{t.unavailable}</p>
      )}
    </div>
  );
}
