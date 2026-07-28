import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Loader2, Receipt, Printer, ChevronRight, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SeoHead } from "@/components/v2/SeoHead";
import { useAuth } from "@/contexts/AuthContext";
import { useMyOrders, useMyOrderDetail } from "@/hooks/v2/useMyOrders";
import { useTranslation } from "@/hooks/useTranslation";
import { formatKwd } from "@/config/v2Flags";
import { format } from "date-fns";
import {
  reconstructLegacyUpaymentsFils,
  useMyLegacyTransactions,
  type MyLegacyTransaction,
} from "@/hooks/v2/useMyLegacyTransactions";

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "paid":
    case "completed":
    case "captured":
    case "success":
      return "default";
    case "refunded":
    case "partially_refunded":
      return "destructive";
    case "pending":
      return "secondary";
    default:
      return "outline";
  }
}

export default function V2OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const {
    data: orders,
    isPending,
    isError,
    refetch,
    fetchStatus,
  } = useMyOrders();
  const {
    data: legacyTransactions,
    isPending: legacyPending,
    isError: legacyError,
    refetch: refetchLegacy,
    fetchStatus: legacyFetchStatus,
  } = useMyLegacyTransactions();
  const { language, isRTL } = useTranslation();
  const lang = language === "ar" ? "ar" : "en";
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Finite loading semantics:
  //  - authLoading      → auth is still resolving; skeleton is honest.
  //  - !user            → redirect to sign in (below).
  //  - fetching now     → skeleton until settled.
  // A disabled query (fetchStatus === 'idle') OR a settled empty query
  // must NOT render a permanent skeleton.
  const showSkeleton =
    authLoading ||
    (!!user &&
      ((isPending && fetchStatus === "fetching") ||
        (legacyPending && legacyFetchStatus === "fetching")));

  if (!authLoading && !user) {
    return <Navigate to={`/login?next=${encodeURIComponent("/orders")}`} replace />;
  }

  const t = {
    title: lang === "ar" ? "طلباتي" : "My orders",
    empty: lang === "ar" ? "لا توجد طلبات بعد." : "No orders yet.",
    browse: lang === "ar" ? "تصفح الموارد" : "Browse resources",
    library: lang === "ar" ? "المكتبة" : "Library",
    total: lang === "ar" ? "الإجمالي" : "Total",
    paid: lang === "ar" ? "المدفوع" : "Paid",
    refunded: lang === "ar" ? "المسترد" : "Refunded",
    items: lang === "ar" ? "العناصر" : "Items",
    print: lang === "ar" ? "طباعة الإيصال" : "Print receipt",
    error: lang === "ar" ? "تعذّر تحميل الطلبات." : "Couldn't load orders.",
    noV2:
      lang === "ar"
        ? "لا توجد طلبات V2 حتى الآن. مشترياتك السابقة محفوظة أدناه."
        : "No V2 orders yet. Your earlier purchases are preserved below.",
    historical: lang === "ar" ? "المشتريات السابقة" : "Historical purchases",
    historicalDesc:
      lang === "ar"
        ? "سجلات دفع للقراءة فقط من JojoPrompts قبل V2. تُعاد قيمة UPayments بالدينار من خريطة الباقات الأصلية عندما يكون ذلك ممكناً."
        : "Read-only payment records from JojoPrompts before V2. UPayments KWD value is reconstructed from the original package mapping when possible.",
    historicalError:
      lang === "ar"
        ? "تعذّر تحميل سجل المشتريات السابقة."
        : "Couldn't load historical purchases.",
  };
  const hasLegacyTransactions = (legacyTransactions ?? []).length > 0;

  return (
    <div className="min-h-[70vh]" dir={isRTL ? "rtl" : "ltr"}>
      <SeoHead title={`${t.title} · JojoPrompts`} canonicalPath="/orders" noindex />
      <main className="container mx-auto max-w-4xl px-4 py-6">
        <header className="mb-4 flex items-center gap-2">
          <Receipt className="h-5 w-5 text-warm-gold" aria-hidden />
          <h1 className="text-2xl font-bold">{t.title}</h1>
        </header>

        {showSkeleton ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : isError ? (
          <div
            className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive space-y-3"
            data-testid="orders-error"
          >
            <p>{t.error}</p>
            <Button
              variant="outline"
              size="sm"
              className="min-h-[44px]"
              onClick={() => refetch()}
            >
              {lang === "ar" ? "إعادة المحاولة" : "Retry"}
            </Button>
          </div>
        ) : (orders ?? []).length === 0 ? (
          <div
            className="rounded-2xl border p-12 text-center space-y-4"
            data-testid="orders-empty"
          >
            <p className="text-muted-foreground">
              {hasLegacyTransactions ? t.noV2 : t.empty}
            </p>
            <p className="text-sm text-muted-foreground">
              {lang === "ar"
                ? "بمجرد إتمام أول عملية شراء ستظهر إيصالاتها هنا."
                : "As soon as you complete your first purchase, its receipt will appear here."}
            </p>
            <Button asChild className="min-h-[44px]">
              <Link to="/explore">{t.browse}</Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-2">
            {(orders ?? []).map((o) => {
              const created = o.placed_at ?? o.created_at;
              return (
                <li key={o.id} className="rounded-xl border">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedId((prev) => (prev === o.id ? null : o.id))
                    }
                    className="flex w-full items-center justify-between gap-3 p-4 text-start min-h-[44px]"
                    aria-expanded={selectedId === o.id}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {o.order_number ?? `#${o.id.slice(0, 8)}`}
                        </span>
                        <Badge variant={statusVariant(o.status)} className="capitalize">
                          {o.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {created ? format(new Date(created), "PPp") : "—"} · {o.item_count} {t.items}
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="font-semibold">{formatKwd(o.total_fils)} KD</div>
                      {o.refunded_fils > 0 ? (
                        <div className="text-xs text-destructive">
                          {t.refunded}: -{formatKwd(o.refunded_fils)}
                        </div>
                      ) : o.paid_fils !== o.total_fils ? (
                        <div className="text-xs text-muted-foreground">
                          {t.paid}: {formatKwd(o.paid_fils)}
                        </div>
                      ) : null}
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 shrink-0 transition-transform ${selectedId === o.id ? "rotate-90" : ""}`}
                      aria-hidden
                    />
                  </button>
                  {selectedId === o.id ? <OrderDetail orderId={o.id} lang={lang} /> : null}
                </li>
              );
            })}
          </ul>
        )}

        {legacyError ? (
          <section className="mt-8 space-y-3" aria-labelledby="legacy-orders-title">
            <h2 id="legacy-orders-title" className="text-lg font-semibold">
              {t.historical}
            </h2>
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <p>{t.historicalError}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 min-h-[44px]"
                onClick={() => refetchLegacy()}
              >
                {lang === "ar" ? "إعادة المحاولة" : "Retry"}
              </Button>
            </div>
          </section>
        ) : hasLegacyTransactions ? (
          <section className="mt-8 space-y-3" aria-labelledby="legacy-orders-title">
            <div>
              <h2
                id="legacy-orders-title"
                className="flex items-center gap-2 text-lg font-semibold"
              >
                <History className="h-5 w-5 text-warm-gold" aria-hidden />
                {t.historical}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t.historicalDesc}
              </p>
            </div>
            <ul className="space-y-2" data-testid="legacy-orders-list">
              {(legacyTransactions ?? []).map((transaction) => (
                <LegacyTransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  lang={lang}
                />
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function LegacyTransactionRow({
  transaction,
  lang,
}: {
  transaction: MyLegacyTransaction;
  lang: "en" | "ar";
}) {
  const reconstructedFils = reconstructLegacyUpaymentsFils(transaction);
  const gateway =
    transaction.payment_gateway?.toLowerCase() === "upayments"
      ? "UPayments"
      : transaction.payment_gateway?.toLowerCase() === "paypal"
        ? "PayPal"
        : transaction.payment_gateway ?? (lang === "ar" ? "بوابة سابقة" : "Legacy gateway");
  const occurredAt = transaction.completed_at ?? transaction.created_at;
  const amount =
    reconstructedFils !== null
      ? `${formatKwd(reconstructedFils)} KD`
      : transaction.payment_gateway?.toLowerCase() === "paypal"
        ? `${Number(transaction.amount_usd).toFixed(2)} USD`
        : `${Number(transaction.amount_usd).toFixed(2)} ${transaction.currency ?? "USD"}`;
  const reference =
    transaction.upayments_invoice_id ??
    transaction.upayments_track_id ??
    transaction.paypal_order_id ??
    transaction.paypal_payment_id;

  return (
    <li className="rounded-xl border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">
              {transaction.subscription_plans?.name ??
                (lang === "ar" ? "شراء سابق" : "Historical purchase")}
            </span>
            <Badge variant={statusVariant(transaction.status)} className="capitalize">
              {transaction.status.replaceAll("_", " ")}
            </Badge>
            <Badge variant="outline">{gateway}</Badge>
            {reconstructedFils !== null ? (
              <Badge variant="secondary">
                {lang === "ar" ? "قيمة مُعاد حسابها" : "Reconstructed value"}
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {format(new Date(occurredAt), "PPp")}
            {reference ? ` · #${reference.slice(-10)}` : ` · #${transaction.id.slice(0, 8)}`}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3 sm:block sm:text-end">
          <div className="font-semibold tabular-nums">{amount}</div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-[44px] px-2"
            onClick={() => window.print()}
          >
            <Printer className="me-1 h-4 w-4" aria-hidden />
            {lang === "ar" ? "طباعة" : "Print"}
          </Button>
        </div>
      </div>
    </li>
  );
}

function OrderDetail({ orderId, lang }: { orderId: string; lang: "en" | "ar" }) {
  const { data, isLoading } = useMyOrderDetail(orderId);
  if (isLoading) {
    return (
      <div className="border-t p-4">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }
  if (!data?.order) return null;
  const t = {
    items: lang === "ar" ? "العناصر" : "Items",
    refunds: lang === "ar" ? "استرداد" : "Refunds",
    print: lang === "ar" ? "طباعة" : "Print",
    library: lang === "ar" ? "المكتبة" : "Library",
    subtotal: lang === "ar" ? "الإجمالي" : "Total",
    paid: lang === "ar" ? "المدفوع" : "Paid",
  };
  const refunded = data.refunds
    .filter((r) => r.status === "processed")
    .reduce((s, r) => s + (r.amount_fils ?? 0), 0);

  return (
    <div className="border-t p-4 space-y-3 text-sm">
      <div>
        <div className="mb-2 font-medium">{t.items}</div>
        <ul className="space-y-1.5">
          {data.items.map((it) => {
            const title =
              lang === "ar" && it.title_ar
                ? it.title_ar
                : it.title_en ?? "—";
            return (
              <li key={it.id} className="flex items-center justify-between gap-2">
                <span className="truncate">{title}</span>
                <span className="text-muted-foreground">
                  {formatKwd(it.line_total_fils)} KD
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-3 text-xs">
        <div>
          <div className="text-muted-foreground">{t.subtotal}</div>
          <div className="font-semibold">{formatKwd(data.order.total_fils)} KD</div>
        </div>
        <div>
          <div className="text-muted-foreground">{t.paid}</div>
          <div className="font-semibold">{formatKwd(data.order.paid_fils)} KD</div>
        </div>
        {refunded > 0 ? (
          <div className="col-span-2">
            <div className="text-muted-foreground">{t.refunds}</div>
            <div className="font-semibold text-destructive">-{formatKwd(refunded)} KD</div>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          className="min-h-[44px]"
          onClick={() => window.print()}
        >
          <Printer className="h-4 w-4 me-1" aria-hidden />
          {t.print}
        </Button>
        <Button asChild size="sm" className="min-h-[44px]">
          <Link to="/library">{t.library}</Link>
        </Button>
      </div>
    </div>
  );
}
