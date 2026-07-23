import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SeoHead } from "@/components/v2/SeoHead";
import { useCart } from "@/hooks/v2/useCart";
import { useAuthoritativeCart } from "@/hooks/v2/useAuthoritativeCart";
import { useIdempotencyKey } from "@/hooks/v2/useIdempotencyKey";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/hooks/useTranslation";
import { supabase } from "@/integrations/supabase/client";
import { formatKwd } from "@/config/v2Flags";
import { toast } from "@/hooks/use-toast";

const UPAY_HOST_RE = /^https:\/\/([a-z0-9-]+\.)*upayments\.com(\/|$)/i;

function friendlyError(code: string | undefined, lang: "en" | "ar"): string {
  const en: Record<string, string> = {
    provider_disabled: "Payments are not available yet. Your cart is saved.",
    configuration_unavailable: "Payments are not available yet. Your cart is saved.",
    overlap_pending_order:
      "You already have a pending checkout for one of these items. Try again in a few minutes.",
    ownership_conflict: "You already own one or more items in this cart.",
    recovery_required:
      "We couldn't complete this request. Please try again shortly.",
  };
  const ar: Record<string, string> = {
    provider_disabled: "الدفع غير متاح حالياً. تم حفظ سلتك.",
    configuration_unavailable: "الدفع غير متاح حالياً. تم حفظ سلتك.",
    overlap_pending_order:
      "لديك عملية دفع معلّقة لأحد هذه العناصر. أعد المحاولة بعد قليل.",
    ownership_conflict: "تمتلك بالفعل أحد العناصر في السلة.",
    recovery_required: "تعذّر إتمام الطلب. حاول مرة أخرى بعد قليل.",
  };
  const map = lang === "ar" ? ar : en;
  return (
    map[code ?? ""] ??
    (lang === "ar"
      ? "حدث خطأ أثناء بدء الدفع. حاول مرة أخرى."
      : "Something went wrong starting checkout. Please try again.")
  );
}

export default function V2CheckoutPage() {
  const { user, loading: authLoading } = useAuth();
  const cart = useCart();
  const { data, isLoading, isError, refetch } = useAuthoritativeCart();
  const { language, isRTL } = useTranslation();
  const lang: "en" | "ar" = language === "ar" ? "ar" : "en";
  const nav = useNavigate();
  const [discount, setDiscount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [providerDown, setProviderDown] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const fingerprint = useMemo(
    () =>
      JSON.stringify({
        p: (data?.chargeableIds ?? []).slice().sort(),
        d: discount.trim().toUpperCase(),
      }),
    [data?.chargeableIds, discount],
  );
  const { key: idempotencyKey } = useIdempotencyKey(fingerprint);

  useEffect(() => {
    setErrMsg(null);
    setProviderDown(false);
  }, [fingerprint]);

  if (!authLoading && !user) {
    return <Navigate to={`/login?next=${encodeURIComponent("/checkout")}`} replace />;
  }

  const t = {
    title: lang === "ar" ? "الدفع" : "Checkout",
    summary: lang === "ar" ? "ملخّص الطلب" : "Order summary",
    discount: lang === "ar" ? "رمز الخصم (اختياري)" : "Discount code (optional)",
    apply: lang === "ar" ? "تطبيق" : "Apply",
    gateway: lang === "ar" ? "بوّابة الدفع" : "Payment gateway",
    upaymentsDesc:
      lang === "ar"
        ? "الدفع عبر UPayments — كي‑نت، فيزا، ماستركارد، Apple Pay."
        : "Pay via UPayments — KNET, Visa, Mastercard, Apple Pay.",
    secure:
      lang === "ar"
        ? "تُعالج المدفوعات على موقع UPayments الآمن."
        : "Payments are processed securely on UPayments.",
    pay: lang === "ar" ? "المتابعة إلى الدفع" : "Continue to payment",
    total: lang === "ar" ? "الإجمالي" : "Total",
    nothing:
      lang === "ar"
        ? "لا توجد عناصر قابلة للدفع في سلتك."
        : "No chargeable items in your cart.",
    review: lang === "ar" ? "راجع السلة" : "Review cart",
    providerDown:
      lang === "ar"
        ? "الدفع غير متاح حالياً. تم حفظ سلتك — عُد قريباً."
        : "Payments are not available yet. Your cart is preserved — check back soon.",
  };

  const handlePay = async () => {
    if (submitting || !data || data.chargeableIds.length === 0) return;
    setSubmitting(true);
    setErrMsg(null);
    setProviderDown(false);
    try {
      const { data: resp, error } = await supabase.functions.invoke(
        "v2-upayments-checkout",
        {
          body: {
            product_ids: data.chargeableIds,
            idempotency_key: idempotencyKey,
            discount_code: discount.trim() || undefined,
            language: lang,
          },
        },
      );
      if (error) {
        // Extract embedded error code where possible.
        const code = (resp as any)?.error ?? undefined;
        if (code === "provider_disabled" || code === "configuration_unavailable") {
          setProviderDown(true);
          return;
        }
        setErrMsg(friendlyError(code, lang));
        return;
      }
      const url = String((resp as any)?.checkout_url ?? "");
      if (!url || !UPAY_HOST_RE.test(url)) {
        setErrMsg(friendlyError("recovery_required", lang));
        return;
      }
      window.location.assign(url);
    } catch {
      setErrMsg(friendlyError(undefined, lang));
    } finally {
      setSubmitting(false);
    }
  };

  if (cart.items.length === 0) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-12 text-center">
        <SeoHead title={`${t.title} · JojoPrompts`} canonicalPath="/checkout" noindex />
        <p className="text-muted-foreground">{t.nothing}</p>
        <Button asChild className="mt-4 min-h-[44px]">
          <Link to="/cart">{t.review}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh]" dir={isRTL ? "rtl" : "ltr"}>
      <SeoHead title={`${t.title} · JojoPrompts`} canonicalPath="/checkout" noindex />
      <main className="container mx-auto max-w-4xl px-4 py-6 space-y-6">
        <h1 className="text-2xl font-bold">{t.title}</h1>

        <div className="grid gap-6 md:grid-cols-3">
          <section className="md:col-span-2 space-y-4">
            <div className="rounded-2xl border p-4 space-y-3">
              <h2 className="font-semibold">{t.summary}</h2>
              {isLoading && !data ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <ul className="space-y-2">
                  {(data?.lines ?? []).map((l) => {
                    const title =
                      lang === "ar" && l.title_ar ? l.title_ar : l.title_en;
                    const excluded = l.status !== "ok";
                    return (
                      <li
                        key={l.product_id}
                        className={`flex items-center justify-between gap-2 text-sm ${excluded ? "text-muted-foreground line-through" : ""}`}
                      >
                        <span className="min-w-0 truncate">{title}</span>
                        <span>{formatKwd(l.price_fils)} KD</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border p-4 space-y-3">
              <label htmlFor="discount" className="block text-sm font-medium">
                {t.discount}
              </label>
              <div className="flex gap-2">
                <Input
                  id="discount"
                  value={discount}
                  maxLength={64}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="min-h-[44px]"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px]"
                  onClick={() => refetch()}
                >
                  {t.apply}
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border p-4 space-y-2">
              <h2 className="font-semibold">{t.gateway}</h2>
              <div className="flex items-center gap-2 rounded-lg border border-warm-gold/40 bg-warm-gold/5 p-3">
                <CreditCard className="h-4 w-4 text-warm-gold" aria-hidden />
                <div className="text-sm">
                  <div className="font-medium">UPayments</div>
                  <div className="text-xs text-muted-foreground">
                    {t.upaymentsDesc}
                  </div>
                </div>
                <Badge variant="secondary" className="ms-auto">KNET</Badge>
                <Badge variant="secondary">Visa</Badge>
                <Badge variant="secondary">Mastercard</Badge>
                <Badge variant="secondary">Apple Pay</Badge>
              </div>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <ShieldCheck className="h-3 w-3" aria-hidden />
                {t.secure}
              </p>
            </div>
          </section>

          <aside className="space-y-3">
            <div className="rounded-2xl border p-4 space-y-3">
              <div className="flex items-baseline justify-between border-b pb-2">
                <span className="font-medium">{t.total}</span>
                <span className="text-lg font-bold">
                  {formatKwd(data?.chargeableTotalFils ?? 0)} KD
                </span>
              </div>
              {providerDown ? (
                <p className="rounded-md border border-warm-gold/40 bg-warm-gold/10 p-3 text-sm">
                  {t.providerDown}
                </p>
              ) : errMsg ? (
                <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {errMsg}
                </p>
              ) : isError ? (
                <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {friendlyError("recovery_required", lang)}
                </p>
              ) : null}
              <Button
                className="w-full min-h-[44px]"
                onClick={handlePay}
                disabled={
                  submitting ||
                  providerDown ||
                  isLoading ||
                  !data ||
                  data.chargeableIds.length === 0
                }
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t.pay
                )}
              </Button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
