import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyLegacyAccessSummary } from "@/hooks/v2/useMyLegacyAccessSummary";
import { useTranslation } from "@/hooks/useTranslation";

function fmtKwd(fils: number): string {
  if (!Number.isFinite(fils)) return "—";
  return `${(fils / 1000).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KWD`;
}
function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString();
}

/**
 * Compact "Legacy access" card, backed by v2_my_legacy_access_summary().
 * Renders lifetime status, included collections, expiry, and verified credit.
 * Never renders a purchase CTA for already-included scopes.
 */
export function LegacyAccessSummary() {
  const { data, isLoading, isError } = useMyLegacyAccessSummary();
  const { language, isRTL } = useTranslation();
  const lang: "en" | "ar" = language === "ar" ? "ar" : "en";

  if (isLoading) {
    return <Skeleton className="h-28 w-full rounded-2xl" />;
  }
  if (isError || !data || data.membership_type === "none") return null;

  const expiry = fmtDate(data.standard_expiry ?? data.basic_expiry ?? null);
  const dirAttr = isRTL ? "rtl" : "ltr";

  return (
    <Card dir={dirAttr}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {lang === "ar" ? "الوصول القديم" : "Legacy access"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {data.lifetime && (
            <Badge className="bg-warm-gold/20 text-warm-gold hover:bg-warm-gold/25 min-h-[28px]">
              {lang === "ar" ? "المكتبة الكاملة مدى الحياة" : "Founding Full Library Lifetime"}
            </Badge>
          )}
          {data.included_collection_keys.map((k) => (
            <Badge key={k} variant="outline" className="min-h-[28px]">
              {k === "library"
                ? lang === "ar" ? "المكتبة الكاملة" : "Full library"
                : k === "chatgpt_prompts"
                  ? "ChatGPT"
                  : k === "midjourney_prompts"
                    ? "Midjourney"
                    : k}
            </Badge>
          ))}
          {data.has_expired_historical && (
            <Badge variant="destructive" className="min-h-[28px]">
              {lang === "ar" ? "منتهي — أرشيف" : "Expired — historical"}
            </Badge>
          )}
          {data.manual_review_required && (
            <Badge variant="secondary" className="min-h-[28px]">
              {lang === "ar" ? "قيد المراجعة" : "Manual review"}
            </Badge>
          )}
        </div>

        <p className="text-sm text-muted-foreground">{data.copy[lang]}</p>

        {expiry && !data.lifetime && (
          <p className="text-xs text-muted-foreground" dir="ltr">
            {lang === "ar" ? "تاريخ الانتهاء الأصلي" : "Original expiry"}: <strong>{expiry}</strong>
          </p>
        )}

        {!data.lifetime && (
          <div className="rounded-md border p-3 text-xs" dir="ltr">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {lang === "ar" ? "الرصيد المؤهل تجاه العضوية الدائمة" : "Verified credit toward lifetime"}
              </span>
              <strong className="tabular-nums">{fmtKwd(data.paypal_verified_credit_fils)}</strong>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">
                {lang === "ar" ? "المتبقي حتى 30.000 دينار" : "Remaining to 30.000 KWD"}
              </span>
              <strong className="tabular-nums">{fmtKwd(data.remaining_lifetime_fils)}</strong>
            </div>
            {data.payment_history_under_review && (
              <div className="mt-2 rounded-md bg-muted/50 p-2 text-[11px] text-muted-foreground">
                {lang === "ar"
                  ? "سجل المدفوعات قيد المراجعة — لا يتم احتساب مدفوعات UPayments حتى تُحسم عملة التحويل."
                  : "Payment history under review — UPayments payments are not counted until currency policy is resolved."}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
