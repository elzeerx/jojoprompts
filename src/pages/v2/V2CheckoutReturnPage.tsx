import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeoHead } from "@/components/v2/SeoHead";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/contexts/AuthContext";
import { cartStore } from "@/hooks/v2/useCart";
import { clearIdempotencyKey } from "@/hooks/v2/useIdempotencyKey";
import { useQueryClient } from "@tanstack/react-query";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ATTEMPTS = 8;
const DEFAULT_INTERVAL_MS = 4000;
const HARD_TIMEOUT_MS = 120_000;

type Verdict =
  | { kind: "loading" }
  | { kind: "paid"; orderId: string; purchasedProductIds: string[] }
  | { kind: "pending"; nextCheckMs: number }
  | { kind: "failed" }
  | { kind: "cancelled" }
  | { kind: "not_found" }
  | { kind: "invalid" };

export default function V2CheckoutReturnPage() {
  const [sp] = useSearchParams();
  const orderIdRaw = sp.get("order_id") ?? "";
  const orderId = UUID_RE.test(orderIdRaw) ? orderIdRaw : null;
  const { user, loading: authLoading } = useAuth();
  const qc = useQueryClient();
  const { language, isRTL } = useTranslation();
  const lang = language === "ar" ? "ar" : "en";
  const [state, setState] = useState<Verdict>({ kind: "loading" });
  const attemptsRef = useRef(0);
  const startedAtRef = useRef(Date.now());
  const cancelledRef = useRef(false);
  const clearedCartRef = useRef(false);

  const t = useMemo(
    () => ({
      title: lang === "ar" ? "حالة الدفع" : "Payment status",
      checking: lang === "ar" ? "جارٍ التحقق من الدفع…" : "Verifying your payment…",
      paid: lang === "ar" ? "تم استلام الدفع" : "Payment received",
      paidDesc:
        lang === "ar"
          ? "تمّت إضافة العناصر إلى مكتبتك."
          : "Your items have been added to your library.",
      pending: lang === "ar" ? "لا تزال قيد المراجعة" : "Still confirming",
      pendingDesc:
        lang === "ar"
          ? "سنتحقق مجدداً بعد قليل. لا تغلق هذه الصفحة إن أمكن."
          : "We'll check again shortly. Keep this page open if possible.",
      failed: lang === "ar" ? "فشل الدفع" : "Payment failed",
      failedDesc:
        lang === "ar"
          ? "لم يتم الخصم. راجع بياناتك وحاول مرة أخرى."
          : "You were not charged. Please review and try again.",
      cancelled: lang === "ar" ? "تم إلغاء الدفع" : "Payment cancelled",
      notFound: lang === "ar" ? "الطلب غير موجود" : "Order not found",
      invalid:
        lang === "ar" ? "رابط الحالة غير صالح." : "Invalid status link.",
      library: lang === "ar" ? "افتح المكتبة" : "Open library",
      orders: lang === "ar" ? "طلباتي" : "My orders",
      retry: lang === "ar" ? "تحقق مرة أخرى" : "Check again",
      backToCart: lang === "ar" ? "الرجوع إلى السلة" : "Back to cart",
      needAuth:
        lang === "ar"
          ? "سجّل الدخول لعرض حالة الدفع."
          : "Sign in to see your payment status.",
    }),
    [lang],
  );

  useEffect(() => {
    if (!orderId) {
      setState({ kind: "invalid" });
      return;
    }
    if (authLoading) return;
    if (!user) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (cancelledRef.current) return;
      if (document.hidden) {
        // Only poll while visible; retry when tab returns.
        timer = setTimeout(tick, 2000);
        return;
      }
      if (Date.now() - startedAtRef.current > HARD_TIMEOUT_MS) {
        setState({ kind: "pending", nextCheckMs: DEFAULT_INTERVAL_MS });
        return;
      }
      if (attemptsRef.current >= MAX_ATTEMPTS) {
        setState({ kind: "pending", nextCheckMs: DEFAULT_INTERVAL_MS });
        return;
      }
      attemptsRef.current += 1;
      try {
        const { data, error } = await supabase.functions.invoke(
          "v2-upayments-status",
          { body: { order_id: orderId } },
        );
        if (cancelledRef.current) return;
        const status = (data as any)?.status;
        const nextAfter = Number((data as any)?.next_check_after ?? 0);
        const wait = Math.max(
          DEFAULT_INTERVAL_MS,
          Number.isFinite(nextAfter) && nextAfter > 0 ? nextAfter * 1000 : 0,
        );
        if (error) {
          setState({ kind: "pending", nextCheckMs: wait });
          timer = setTimeout(tick, wait);
          return;
        }
        if (status === "paid") {
          const productIds: string[] = Array.isArray((data as any)?.product_ids)
            ? (data as any).product_ids.filter(
                (x: unknown): x is string => typeof x === "string",
              )
            : [];
          if (!clearedCartRef.current) {
            clearedCartRef.current = true;
            const toClear = productIds.length > 0 ? productIds : cartStore.read().map((i) => i.product_id);
            cartStore.removeMany(toClear);
            clearIdempotencyKey();
          }
          qc.invalidateQueries({ queryKey: ["v2"] });
          setState({ kind: "paid", orderId, purchasedProductIds: productIds });
          return;
        }
        if (status === "failed") {
          setState({ kind: "failed" });
          return;
        }
        if (status === "cancelled") {
          setState({ kind: "cancelled" });
          return;
        }
        if (status === "not_found") {
          setState({ kind: "not_found" });
          return;
        }
        // pending / backoff / global_backoff → schedule next.
        setState({ kind: "pending", nextCheckMs: wait });
        timer = setTimeout(tick, wait);
      } catch {
        setState({ kind: "pending", nextCheckMs: DEFAULT_INTERVAL_MS });
        timer = setTimeout(tick, DEFAULT_INTERVAL_MS);
      }
    };

    const onVisible = () => {
      if (!document.hidden && state.kind === "pending") {
        // no-op: existing timer will resume
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    tick();
    return () => {
      cancelledRef.current = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, user, authLoading]);

  const manualCheck = () => {
    attemptsRef.current = 0;
    startedAtRef.current = Date.now();
    cancelledRef.current = false;
    setState({ kind: "loading" });
  };

  return (
    <div className="min-h-[70vh]" dir={isRTL ? "rtl" : "ltr"}>
      <SeoHead title={`${t.title} · JojoPrompts`} canonicalPath="/checkout/return" noindex />
      <main className="container mx-auto max-w-xl px-4 py-12 text-center space-y-5">
        {!orderId ? (
          <>
            <XCircle className="mx-auto h-10 w-10 text-destructive" aria-hidden />
            <h1 className="text-xl font-semibold">{t.invalid}</h1>
            <Button asChild className="min-h-[44px]">
              <Link to="/cart">{t.backToCart}</Link>
            </Button>
          </>
        ) : authLoading ? (
          <Loader2 className="mx-auto h-8 w-8 animate-spin" aria-hidden />
        ) : !user ? (
          <>
            <p className="text-muted-foreground">{t.needAuth}</p>
            <Button asChild className="min-h-[44px]">
              <Link to={`/login?next=${encodeURIComponent(`/checkout/return?order_id=${orderId}`)}`}>
                {t.needAuth}
              </Link>
            </Button>
          </>
        ) : state.kind === "loading" ? (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-warm-gold" aria-hidden />
            <p>{t.checking}</p>
          </>
        ) : state.kind === "paid" ? (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden />
            <h1 className="text-2xl font-bold">{t.paid}</h1>
            <p className="text-muted-foreground">{t.paidDesc}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild className="min-h-[44px]">
                <Link to="/library">{t.library}</Link>
              </Button>
              <Button asChild variant="outline" className="min-h-[44px]">
                <Link to="/orders">{t.orders}</Link>
              </Button>
            </div>
          </>
        ) : state.kind === "pending" ? (
          <>
            <Clock className="mx-auto h-10 w-10 text-warm-gold" aria-hidden />
            <h1 className="text-xl font-semibold">{t.pending}</h1>
            <p className="text-muted-foreground">{t.pendingDesc}</p>
            <Button onClick={manualCheck} className="min-h-[44px]">{t.retry}</Button>
          </>
        ) : state.kind === "failed" ? (
          <>
            <XCircle className="mx-auto h-10 w-10 text-destructive" aria-hidden />
            <h1 className="text-xl font-semibold">{t.failed}</h1>
            <p className="text-muted-foreground">{t.failedDesc}</p>
            <Button asChild className="min-h-[44px]">
              <Link to="/cart">{t.backToCart}</Link>
            </Button>
          </>
        ) : state.kind === "cancelled" ? (
          <>
            <XCircle className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
            <h1 className="text-xl font-semibold">{t.cancelled}</h1>
            <Button asChild className="min-h-[44px]">
              <Link to="/cart">{t.backToCart}</Link>
            </Button>
          </>
        ) : (
          <>
            <XCircle className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
            <h1 className="text-xl font-semibold">{t.notFound}</h1>
            <Button asChild className="min-h-[44px]">
              <Link to="/cart">{t.backToCart}</Link>
            </Button>
          </>
        )}
      </main>
    </div>
  );
}
