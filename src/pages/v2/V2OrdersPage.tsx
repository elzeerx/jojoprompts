import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Loader2, Receipt, Printer, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SeoHead } from "@/components/v2/SeoHead";
import { useAuth } from "@/contexts/AuthContext";
import { useMyOrders, useMyOrderDetail } from "@/hooks/v2/useMyOrders";
import { useTranslation } from "@/hooks/useTranslation";
import { formatKwd } from "@/config/v2Flags";
import { format } from "date-fns";

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "paid":
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
  const { user, loading } = useAuth();
  const { data: orders, isLoading, isError } = useMyOrders();
  const { language, isRTL } = useTranslation();
  const lang = language === "ar" ? "ar" : "en";
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!loading && !user) {
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
  };

  return (
    <div className="min-h-[70vh]" dir={isRTL ? "rtl" : "ltr"}>
      <SeoHead title={`${t.title} · JojoPrompts`} canonicalPath="/orders" noindex />
      <main className="container mx-auto max-w-4xl px-4 py-6">
        <header className="mb-4 flex items-center gap-2">
          <Receipt className="h-5 w-5 text-warm-gold" aria-hidden />
          <h1 className="text-2xl font-bold">{t.title}</h1>
        </header>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : isError ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {t.error}
          </p>
        ) : (orders ?? []).length === 0 ? (
          <div className="rounded-2xl border p-12 text-center space-y-4">
            <p className="text-muted-foreground">{t.empty}</p>
            <Button asChild className="min-h-[44px]">
              <Link to="/explore">{t.browse}</Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-2">
            {(orders ?? []).map((o: any) => {
              const created = o.placed_at ?? o.created_at;
              const items = o.order_items ?? [];
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
                          #{o.id.slice(0, 8)}
                        </span>
                        <Badge variant={statusVariant(o.status)} className="capitalize">
                          {o.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {created ? format(new Date(created), "PPp") : "—"} · {items.length} {t.items}
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="font-semibold">{formatKwd(o.total_fils)} KD</div>
                      {o.paid_fils !== o.total_fils ? (
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
      </main>
    </div>
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
    .filter((r: any) => r.status === "processed")
    .reduce((s: number, r: any) => s + (r.amount_fils ?? 0), 0);
  return (
    <div className="border-t p-4 space-y-3 text-sm">
      <div>
        <div className="mb-2 font-medium">{t.items}</div>
        <ul className="space-y-1.5">
          {data.items.map((it: any) => {
            const snap = it.product_snapshot ?? {};
            const title =
              (lang === "ar" && snap.title_ar) ? snap.title_ar : snap.title_en ?? snap.title ?? "—";
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
