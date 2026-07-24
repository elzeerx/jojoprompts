import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2, Clock, Info, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeoHead } from "@/components/v2/SeoHead";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/hooks/useTranslation";
import { clearIdempotencyKey } from "@/hooks/v2/useIdempotencyKey";
import { supabase } from "@/integrations/supabase/client";
import { extractInvokeErrorCode } from "@/lib/v2/invokeErrors";
import { resolveCallbackOrderId } from "@/lib/v2/callbackOrderId";

/**
 * Cancel page — verifies the prior order/attempt through the authenticated
 * `v2-upayments-status` function before allowing any retry. Provider callback
 * query fields are NEVER trusted for money state. The old order is preserved
 * as historical; a retry creates a fresh order + attempt.
 */

type Verdict =
  | { kind: "invalid" }
  | { kind: "checking" }
  | { kind: "paid" }
  | { kind: "failed" }
  | { kind: "cancelled" }
  | { kind: "pending"; reason?: string }
  | { kind: "unverifiable"; reason?: string };

const COOLDOWN_MS = 5_000;

export default function V2CheckoutCancelPage() {
  const params = useParams<{ orderId?: string }>();
  const [sp] = useSearchParams();
  const orderId = resolveCallbackOrderId(params.orderId, sp.get("order_id"));
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const { language, isRTL } = useTranslation();
  const lang: "en" | "ar" = language === "ar" ? "ar" : "en";

  const [state, setState] = useState<Verdict>(
    orderId ? { kind: "checking" } : { kind: "invalid" },
  );
  const [checkNonce, setCheckNonce] = useState(0);
  const [inFlight, setInFlight] = useState(false);
  const [nextAllowedAt, setNextAllowedAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const paidRedirectRef = useRef(false);

  const t = useMemo(
    () => ({
      title: lang === "ar" ? "التحقق من الدفع" : "Verifying payment",
      checking:
        lang === "ar"
          ? "لم يكتمل الدفع بعد. نتحقق من حالته لدى بوّابة الدفع…"
          : "Your payment was not completed. We're checking its status with the gateway…",
      preserveCart:
        lang === "ar"
          ? "سلتك محفوظة كما هي."
          : "Your cart is preserved.",
      paidTitle: lang === "ar" ? "تم استلام الدفع فعلياً" : "Payment was completed",
      paidDesc:
        lang === "ar"
          ? "سنعيد توجيهك إلى صفحة نتيجة الدفع…"
          : "Redirecting you to the payment result page…",
      pendingTitle:
        lang === "ar" ? "لا تزال الحالة قيد التحقق" : "Status still being verified",
      pendingDesc:
        lang === "ar"
          ? "حالة الدفع السابقة لم تُؤكَّد بعد. لا يمكن بدء دفع جديد حتى تنتهي المراجعة."
          : "Your previous payment isn't confirmed yet. A new checkout can't start until this is resolved.",
      unverifiableTitle:
        lang === "ar" ? "تعذّر التحقق حالياً" : "Unable to verify right now",
      unverifiableDesc:
        lang === "ar"
          ? "تعذّر الوصول إلى بوّابة الدفع للتحقق. حاول التحقق مجدداً بعد قليل."
          : "We couldn't reach the gateway to verify. Please re-check in a moment.",
      failedTitle: lang === "ar" ? "لم يكتمل الدفع" : "Payment was not completed",
      failedDesc:
        lang === "ar"
          ? "لم يتم خصم أي مبلغ. يمكنك محاولة الدفع مجدداً — سيتم إنشاء طلب جديد."
          : "You were not charged. You can try checkout again — a fresh order will be created.",
      cancelledTitle: lang === "ar" ? "تم إلغاء الدفع" : "Payment cancelled",
      cancelledDesc:
        lang === "ar"
          ? "لم يتم خصم أي مبلغ. يمكنك محاولة الدفع مجدداً."
          : "You were not charged. You can try checkout again.",
      recheck: lang === "ar" ? "تحقق مرة أخرى" : "Re-check status",
      recheckIn: (s: number) =>
        lang === "ar" ? `أعد المحاولة خلال ${s}ث` : `Re-check in ${s}s`,
      checkingBtn: lang === "ar" ? "جارٍ التحقق…" : "Checking…",
      backToCart: lang === "ar" ? "الرجوع إلى السلة" : "Return to cart",
      tryAgain: lang === "ar" ? "حاول الدفع مجدداً" : "Try payment again",
      viewOrders: lang === "ar" ? "طلباتي" : "My orders",
      invalid: lang === "ar" ? "رابط الحالة غير صالح." : "Invalid status link.",
    }),
    [lang],
  );

  // Ticker so cooldown countdown updates.
  useEffect(() => {
    const remaining = nextAllowedAt - Date.now();
    if (remaining <= 0) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [nextAllowedAt]);

  useEffect(() => {
    if (!orderId || authLoading || !user) return;
    let cancelled = false;
    setInFlight(true);
    setState({ kind: "checking" });
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke(
          "v2-upayments-status",
          { body: { order_id: orderId } },
        );
        if (cancelled) return;
        const errorCode = error
          ? await extractInvokeErrorCode(data, error)
          : undefined;
        if (errorCode) {
          setState({ kind: "unverifiable", reason: errorCode });
          return;
        }
        const status = (data as { status?: string } | null)?.status;
        const reason = (data as { reason?: string } | null)?.reason;
        if (status === "paid") {
          setState({ kind: "paid" });
          return;
        }
        if (status === "failed") {
          clearIdempotencyKey();
          setState({ kind: "failed" });
          return;
        }
        if (status === "cancelled") {
          clearIdempotencyKey();
          setState({ kind: "cancelled" });
          return;
        }
        if (status === "pending") {
          setState({ kind: "pending", reason });
          return;
        }
        setState({ kind: "unverifiable", reason });
      } catch {
        if (!cancelled) setState({ kind: "unverifiable" });
      } finally {
        if (!cancelled) {
          setInFlight(false);
          setNextAllowedAt(Date.now() + COOLDOWN_MS);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, user, authLoading, checkNonce]);

  useEffect(() => {
    if (state.kind !== "paid" || !orderId || paidRedirectRef.current) return;
    paidRedirectRef.current = true;
    const id = window.setTimeout(() => {
      nav(`/checkout/return/${orderId}`, { replace: true });
    }, 900);
    return () => window.clearTimeout(id);
  }, [state.kind, orderId, nav]);

  const cooldownRemainingMs = Math.max(0, nextAllowedAt - now);
  const recheckDisabled = inFlight || cooldownRemainingMs > 0;
  const recheckLabel = inFlight
    ? t.checkingBtn
    : cooldownRemainingMs > 0
      ? t.recheckIn(Math.ceil(cooldownRemainingMs / 1000))
      : t.recheck;

  const handleRecheck = useCallback(() => {
    if (recheckDisabled) return;
    setCheckNonce((n) => n + 1);
  }, [recheckDisabled]);

  const handleTryAgain = useCallback(() => {
    clearIdempotencyKey();
    nav("/checkout");
  }, [nav]);

  if (!authLoading && !user && orderId) {
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(`/checkout/cancel/${orderId}`)}`}
        replace
      />
    );
  }

  return (
    <div className="min-h-[70vh]" dir={isRTL ? "rtl" : "ltr"}>
      <SeoHead
        title={`${t.title} · JojoPrompts`}
        canonicalPath="/checkout/cancel"
        noindex
      />
      <main className="container mx-auto max-w-xl px-4 py-12 text-center space-y-5">
        {state.kind === "invalid" ? (
          <>
            <XCircle className="mx-auto h-10 w-10 text-destructive" aria-hidden />
            <h1 className="text-xl font-semibold">{t.invalid}</h1>
            <Button asChild className="min-h-[44px]">
              <Link to="/cart">{t.backToCart}</Link>
            </Button>
          </>
        ) : authLoading ? (
          <Loader2 className="mx-auto h-8 w-8 animate-spin" aria-hidden />
        ) : state.kind === "checking" ? (
          <>
            <Loader2
              className="mx-auto h-10 w-10 animate-spin text-warm-gold"
              aria-hidden
            />
            <h1 className="text-2xl font-bold">{t.title}</h1>
            <p className="text-muted-foreground">{t.checking}</p>
            <p className="text-xs text-muted-foreground">{t.preserveCart}</p>
          </>
        ) : state.kind === "paid" ? (
          <>
            <CheckCircle2
              className="mx-auto h-10 w-10 text-emerald-600"
              aria-hidden
            />
            <h1 className="text-2xl font-bold">{t.paidTitle}</h1>
            <p className="text-muted-foreground">{t.paidDesc}</p>
          </>
        ) : state.kind === "pending" || state.kind === "unverifiable" ? (
          <>
            <Clock className="mx-auto h-10 w-10 text-warm-gold" aria-hidden />
            <h1 className="text-xl font-semibold">
              {state.kind === "pending" ? t.pendingTitle : t.unverifiableTitle}
            </h1>
            <p className="text-muted-foreground">
              {state.kind === "pending" ? t.pendingDesc : t.unverifiableDesc}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                onClick={handleRecheck}
                disabled={recheckDisabled}
                className="min-h-[44px]"
              >
                {inFlight ? (
                  <Loader2 className="me-1 h-4 w-4 animate-spin" aria-hidden />
                ) : null}
                {recheckLabel}
              </Button>
              <Button asChild variant="outline" className="min-h-[44px]">
                <Link to="/orders">{t.viewOrders}</Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t.preserveCart}</p>
          </>
        ) : (
          // failed / cancelled — verified terminal, retry allowed.
          <>
            <Info className="mx-auto h-10 w-10 text-warm-gold" aria-hidden />
            <h1 className="text-2xl font-bold">
              {state.kind === "failed" ? t.failedTitle : t.cancelledTitle}
            </h1>
            <p className="text-muted-foreground">
              {state.kind === "failed" ? t.failedDesc : t.cancelledDesc}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild variant="outline" className="min-h-[44px]">
                <Link to="/cart">{t.backToCart}</Link>
              </Button>
              <Button onClick={handleTryAgain} className="min-h-[44px]">
                {t.tryAgain}
              </Button>
            </div>
          </>
        )}
        {orderId ? (
          <p className="text-xs text-muted-foreground">
            {lang === "ar" ? "معرّف الطلب" : "Order id"}: <code>{orderId}</code>
          </p>
        ) : null}
      </main>
    </div>
  );
}
