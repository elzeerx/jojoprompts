import { Link, useParams, useSearchParams } from "react-router-dom";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeoHead } from "@/components/v2/SeoHead";
import { useTranslation } from "@/hooks/useTranslation";
import { resolveCallbackOrderId } from "@/lib/v2/callbackOrderId";

/**
 * Cancel is a display-only page — it never mutates payment state.
 * Cart is preserved untouched.
 *
 * Reads the order id from a clean path parameter first
 * (`/checkout/cancel/:orderId`) and falls back to the legacy
 * `?order_id=<uuid>` query for backward compatibility. Malformed legacy
 * links where `order_id` contained provider-appended query parameters are
 * safely recovered via {@link resolveCallbackOrderId}. Only a validated
 * UUID is ever displayed.
 */
export default function V2CheckoutCancelPage() {
  const params = useParams<{ orderId?: string }>();
  const [sp] = useSearchParams();
  const orderId = resolveCallbackOrderId(params.orderId, sp.get("order_id"));
  const { language, isRTL } = useTranslation();
  const lang = language === "ar" ? "ar" : "en";

  const t = {
    title: lang === "ar" ? "تم إلغاء الدفع" : "Payment cancelled",
    body:
      lang === "ar"
        ? "لم يتم خصم أي مبلغ، وسلتك محفوظة كما هي."
        : "You were not charged and your cart is preserved.",
    backToCart: lang === "ar" ? "الرجوع إلى السلة" : "Return to cart",
    tryAgain: lang === "ar" ? "حاول الدفع مجدداً" : "Try checkout again",
  };

  return (
    <div className="min-h-[70vh]" dir={isRTL ? "rtl" : "ltr"}>
      <SeoHead title={`${t.title} · JojoPrompts`} canonicalPath="/checkout/cancel" noindex />
      <main className="container mx-auto max-w-xl px-4 py-12 text-center space-y-5">
        <Info className="mx-auto h-10 w-10 text-warm-gold" aria-hidden />
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <p className="text-muted-foreground">{t.body}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild variant="outline" className="min-h-[44px]">
            <Link to="/cart">{t.backToCart}</Link>
          </Button>
          <Button asChild className="min-h-[44px]">
            <Link to="/checkout">{t.tryAgain}</Link>
          </Button>
        </div>
        {orderId ? (
          <p className="text-xs text-muted-foreground">
            {lang === "ar" ? "معرّف الطلب" : "Order id"}: <code>{orderId}</code>
          </p>
        ) : null}
      </main>
    </div>
  );
}
