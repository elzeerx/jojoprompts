import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trash2, Loader2, ShoppingBag } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SeoHead } from "@/components/v2/SeoHead";
import { LifetimeUpgradeCard } from "@/components/v2/LifetimeUpgradeCard";
import { useCart } from "@/hooks/v2/useCart";
import { useAuthoritativeCart } from "@/hooks/v2/useAuthoritativeCart";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/hooks/useTranslation";
import { formatKwd } from "@/config/v2Flags";

export default function CartPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const cart = useCart();
  const { data, isLoading, isError } = useAuthoritativeCart();
  const { language, isRTL } = useTranslation();
  const lang = language === "ar" ? "ar" : "en";

  const t = useMemo(
    () => ({
      title: lang === "ar" ? "سلة التسوق" : "Your cart",
      empty: lang === "ar" ? "سلتك فارغة." : "Your cart is empty.",
      browse: lang === "ar" ? "تصفح الموارد" : "Browse resources",
      remove: lang === "ar" ? "إزالة" : "Remove",
      clear: lang === "ar" ? "إفراغ السلة" : "Clear cart",
      clearConfirm:
        lang === "ar" ? "هل تريد إزالة كل العناصر؟" : "Remove all items from your cart?",
      clearYes: lang === "ar" ? "نعم، إفراغ" : "Yes, clear",
      cancel: lang === "ar" ? "إلغاء" : "Cancel",
      subtotal: lang === "ar" ? "المجموع الفرعي" : "Subtotal",
      total: lang === "ar" ? "الإجمالي" : "Total",
      checkout: lang === "ar" ? "المتابعة إلى الدفع" : "Continue to checkout",
      signInFirst: lang === "ar" ? "سجّل الدخول للمتابعة" : "Sign in to continue",
      loadError:
        lang === "ar"
          ? "تعذّر تحديث السلة. حاول مرة أخرى."
          : "Couldn't refresh cart. Try again.",
      inactive: lang === "ar" ? "غير متاح" : "Unavailable",
      missing: lang === "ar" ? "المنتج غير موجود" : "Product no longer exists",
      owned: lang === "ar" ? "تمتلك هذا المورد بالفعل" : "You already own this",
      includedLifetime:
        lang === "ar" ? "مضمّن مع مدى الحياة" : "Included with your Lifetime access",
      willExclude:
        lang === "ar"
          ? "سيُستبعد من الدفع."
          : "Will be excluded from checkout.",
    }),
    [lang],
  );

  return (
    <div className="min-h-[70vh]" dir={isRTL ? "rtl" : "ltr"}>
      <SeoHead title={`${t.title} · JojoPrompts`} canonicalPath="/cart" noindex />
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <header className="mb-6 flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-warm-gold" aria-hidden />
          <h1 className="text-2xl font-bold">{t.title}</h1>
        </header>

        {cart.items.length === 0 ? (
          <div className="rounded-2xl border p-12 text-center space-y-4">
            <p className="text-muted-foreground">{t.empty}</p>
            <Button asChild className="min-h-[44px]">
              <Link to="/explore">{t.browse}</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            <section className="md:col-span-2 space-y-3">
              {isError ? (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {t.loadError}
                </p>
              ) : null}
              {isLoading && !data ? (
                <>
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </>
              ) : (
                (data?.lines ?? []).map((line) => {
                  const title =
                    lang === "ar" && line.title_ar ? line.title_ar : line.title_en;
                  const blocker = line.status !== "ok";
                  const blockerLabel =
                    line.status === "inactive"
                      ? t.inactive
                      : line.status === "missing"
                        ? t.missing
                        : line.status === "owned"
                          ? t.owned
                          : line.status === "included_with_lifetime"
                            ? t.includedLifetime
                            : null;
                  return (
                    <article
                      key={line.product_id}
                      className={`rounded-xl border p-4 ${
                        blocker ? "border-warm-gold/40 bg-warm-gold/5" : ""
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {line.resource_type ? (
                              <Badge variant="outline" className="capitalize">
                                {line.resource_type.replace("_", " ")}
                              </Badge>
                            ) : null}
                            {line.product_type === "lifetime" ? (
                              <Badge>Lifetime</Badge>
                            ) : line.product_type === "bundle" ? (
                              <Badge variant="secondary">Bundle</Badge>
                            ) : null}
                          </div>
                          <div className="mt-1 font-medium">
                            {line.resource_slug ? (
                              <Link
                                to={`/resources/${line.resource_slug}`}
                                className="hover:underline"
                              >
                                {title}
                              </Link>
                            ) : (
                              title
                            )}
                          </div>
                          {blockerLabel ? (
                            <p className="mt-2 text-xs font-medium text-warm-gold">
                              {blockerLabel} — {t.willExclude}
                            </p>
                          ) : null}
                        </div>
                        <div className="text-end">
                          <div className={blocker ? "text-muted-foreground line-through" : "font-semibold"}>
                            {formatKwd(line.price_fils)} KD
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => cart.remove(line.product_id)}
                            className="mt-1 min-h-[44px] text-muted-foreground"
                            aria-label={t.remove}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                            <span className="ms-1 sr-only sm:not-sr-only">{t.remove}</span>
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}

              {cart.items.length > 0 ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="min-h-[44px] text-muted-foreground">
                      {t.clear}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t.clearConfirm}</AlertDialogTitle>
                      <AlertDialogDescription />
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => cart.clear()}>
                        {t.clearYes}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
            </section>

            <aside className="space-y-4">
              <div className="rounded-2xl border p-4 space-y-3">
                {isLoading && !data ? (
                  <Skeleton className="h-6 w-full" />
                ) : (
                  <>
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm text-muted-foreground">{t.subtotal}</span>
                      <span className="font-semibold">
                        {formatKwd(data?.chargeableTotalFils ?? 0)} KD
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between border-t pt-2">
                      <span className="font-medium">{t.total}</span>
                      <span className="text-lg font-bold">
                        {formatKwd(data?.chargeableTotalFils ?? 0)} KD
                      </span>
                    </div>
                  </>
                )}
                <Button
                  className="w-full min-h-[44px]"
                  disabled={
                    isLoading ||
                    !data ||
                    data.chargeableIds.length === 0
                  }
                  onClick={() => {
                    if (!user) {
                      nav(`/login?next=${encodeURIComponent("/checkout")}`);
                      return;
                    }
                    nav("/checkout");
                  }}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : user ? (
                    t.checkout
                  ) : (
                    t.signInFirst
                  )}
                </Button>
              </div>
              <LifetimeUpgradeCard />
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
