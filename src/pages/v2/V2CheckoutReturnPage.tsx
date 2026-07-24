import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeoHead } from "@/components/v2/SeoHead";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/contexts/AuthContext";
import { cartStore } from "@/hooks/v2/useCart";
import { clearIdempotencyKey } from "@/hooks/v2/useIdempotencyKey";
import { useQueryClient } from "@tanstack/react-query";
import { extractInvokeErrorCode } from "@/lib/v2/invokeErrors";
import { resolveCallbackOrderId } from "@/lib/v2/callbackOrderId";

const MAX_ATTEMPTS = 8;
const MIN_INTERVAL_MS = 4_000;
/** Honor the server's per-provider 5-minute cap plus a small clock-skew margin. */
const MAX_INTERVAL_MS = 310_000;
const HARD_TIMEOUT_MS = 15 * 60_000;

type Verdict =
  | { kind: "loading" }
  | { kind: "paid"; orderId: string; purchasedProductIds: string[] }
  | { kind: "pending" }
  | { kind: "failed" }
  | { kind: "cancelled" }
  | { kind: "not_found" }
  | { kind: "provider_down" }
  | { kind: "invalid" };

/**
 * Parse the server's `next_check_after` ISO timestamp into a wait duration in
 * ms. The server enforces a 5-minute cap; we clamp to [MIN_INTERVAL_MS,
 * MAX_INTERVAL_MS] so we never poll faster than the server allows and never
 * truncate a longer cooldown down to a quick retry.
 */
function parseNextCheckMs(raw: unknown): number {
  if (typeof raw !== "string" || raw.length === 0) return MIN_INTERVAL_MS;
  const ts = Date.parse(raw);
  if (!Number.isFinite(ts)) return MIN_INTERVAL_MS;
  const delta = ts - Date.now();
  return Math.min(MAX_INTERVAL_MS, Math.max(MIN_INTERVAL_MS, delta));
}

/**
 * Extract the response body's `reason` field. Successful 202 responses from
 * the status function may carry `provider_disabled`/`configuration_unavailable`
 * even though `error` is absent — we treat that identically to the error
 * pathway.
 */
function readProviderDownReason(data: unknown): boolean {
  const reason = (data as { reason?: unknown } | null | undefined)?.reason;
  return reason === "provider_disabled" || reason === "configuration_unavailable";
}

export default function V2CheckoutReturnPage() {
  const [sp] = useSearchParams();
  const orderIdRaw = sp.get("order_id") ?? "";
  const orderId = UUID_RE.test(orderIdRaw) ? orderIdRaw : null;
  const { user, loading: authLoading } = useAuth();
  const qc = useQueryClient();
  const { language, isRTL } = useTranslation();
  const lang = language === "ar" ? "ar" : "en";
  const [state, setState] = useState<Verdict>({ kind: "loading" });
  /** Bumping this re-runs the polling effect (manual retry). */
  const [pollNonce, setPollNonce] = useState(0);
  /** ms epoch at which manual "Check again" is allowed. */
  const [nextAllowedAt, setNextAllowedAt] = useState<number>(0);
  const [now, setNow] = useState<number>(() => Date.now());
  const [inFlight, setInFlight] = useState(false);
  const clearedCartRef = useRef(false);
  const terminalRef = useRef(false);

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
      invalid: lang === "ar" ? "رابط الحالة غير صالح." : "Invalid status link.",
      providerDown:
        lang === "ar"
          ? "الدفع غير متاح حالياً. تم حفظ سلتك — عُد قريباً."
          : "Payments are not available yet. Your cart is preserved — check back soon.",
      library: lang === "ar" ? "افتح المكتبة" : "Open library",
      orders: lang === "ar" ? "طلباتي" : "My orders",
      retry: lang === "ar" ? "تحقق مرة أخرى" : "Check again",
      retryIn: (s: number) =>
        lang === "ar" ? `أعد المحاولة خلال ${s}ث` : `Retry in ${s}s`,
      inFlight: lang === "ar" ? "جارٍ التحقق…" : "Checking…",
      backToCart: lang === "ar" ? "الرجوع إلى السلة" : "Back to cart",
      needAuth:
        lang === "ar"
          ? "سجّل الدخول لعرض حالة الدفع."
          : "Sign in to see your payment status.",
    }),
    [lang],
  );

  // Lightweight "now" ticker to enable the retry button when cooldown expires.
  useEffect(() => {
    if (state.kind !== "pending") return;
    const remaining = nextAllowedAt - Date.now();
    if (remaining <= 0) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [state.kind, nextAllowedAt]);

  useEffect(() => {
    if (!orderId) {
      setState({ kind: "invalid" });
      return;
    }
    if (authLoading) return;
    if (!user) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    const startedAt = Date.now();
    terminalRef.current = false;
    setState({ kind: "loading" });
    setInFlight(false);
    setNextAllowedAt(0);

    const schedule = (ms: number) => {
      if (cancelled) return;
      timer = setTimeout(tick, ms);
    };

    const tick = async () => {
      if (cancelled || terminalRef.current) return;
      if (document.hidden) {
        schedule(2_000);
        return;
      }
      if (Date.now() - startedAt > HARD_TIMEOUT_MS) {
        setState({ kind: "pending" });
        return;
      }
      if (attempts >= MAX_ATTEMPTS) {
        setState({ kind: "pending" });
        return;
      }
      attempts += 1;
      setInFlight(true);
      try {
        const { data, error } = await supabase.functions.invoke(
          "v2-upayments-status",
          { body: { order_id: orderId } },
        );
        if (cancelled) return;

        // Provider-off may arrive on either the error pathway (non-2xx) OR
        // as a successful 202 body with `reason: provider_disabled`.
        const errorCode = error
          ? await extractInvokeErrorCode(data, error)
          : undefined;
        const providerDown =
          errorCode === "provider_disabled" ||
          errorCode === "configuration_unavailable" ||
          readProviderDownReason(data);
        if (providerDown) {
          terminalRef.current = true;
          setState({ kind: "provider_down" });
          return;
        }

        const wait = parseNextCheckMs((data as any)?.next_check_after);
        setNextAllowedAt(Date.now() + wait);

        if (error) {
          setState({ kind: "pending" });
          schedule(wait);
          return;
        }

        const status = (data as any)?.status;
        if (status === "paid") {
          const raw = (data as any)?.product_ids;
          const productIds: string[] = Array.isArray(raw)
            ? raw.filter((x: unknown): x is string => typeof x === "string")
            : [];
          if (!clearedCartRef.current) {
            clearedCartRef.current = true;
            if (productIds.length > 0) {
              cartStore.removeMany(productIds);
            }
            clearIdempotencyKey();
          }
          qc.invalidateQueries({ queryKey: ["v2"] });
          terminalRef.current = true;
          setState({ kind: "paid", orderId, purchasedProductIds: productIds });
          return;
        }
        if (status === "failed") {
          // Verified terminal failure — rotate idempotency key so the next
          // attempt is fresh, but preserve the cart.
          clearIdempotencyKey();
          terminalRef.current = true;
          setState({ kind: "failed" });
          return;
        }
        if (status === "cancelled") {
          clearIdempotencyKey();
          terminalRef.current = true;
          setState({ kind: "cancelled" });
          return;
        }
        if (status === "not_found") {
          terminalRef.current = true;
          setState({ kind: "not_found" });
          return;
        }
        // pending / backoff / global_backoff → schedule next respecting server.
        setState({ kind: "pending" });
        schedule(wait);
      } catch {
        setState({ kind: "pending" });
        setNextAllowedAt(Date.now() + MIN_INTERVAL_MS);
        schedule(MIN_INTERVAL_MS);
      } finally {
        if (!cancelled) setInFlight(false);
      }
    };

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orderId, user, authLoading, qc, pollNonce]);

  const cooldownRemainingMs = Math.max(0, nextAllowedAt - now);
  const retryDisabled = inFlight || cooldownRemainingMs > 0;
  const retryLabel = inFlight
    ? t.inFlight
    : cooldownRemainingMs > 0
      ? t.retryIn(Math.ceil(cooldownRemainingMs / 1000))
      : t.retry;

  const manualCheck = useCallback(() => {
    if (inFlight) return;
    if (Date.now() < nextAllowedAt) return;
    setPollNonce((n) => n + 1);
  }, [inFlight, nextAllowedAt]);

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
            <Button
              onClick={manualCheck}
              disabled={retryDisabled}
              className="min-h-[44px]"
            >
              {inFlight ? (
                <Loader2 className="me-1 h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              {retryLabel}
            </Button>
          </>
        ) : state.kind === "provider_down" ? (
          <>
            <Clock className="mx-auto h-10 w-10 text-warm-gold" aria-hidden />
            <p className="rounded-md border border-warm-gold/40 bg-warm-gold/10 p-3 text-sm">
              {t.providerDown}
            </p>
            <Button asChild variant="outline" className="min-h-[44px]">
              <Link to="/cart">{t.backToCart}</Link>
            </Button>
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
