import { useMemo } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import {
  User,
  LibraryBig,
  Receipt,
  Shield,
  LogOut,
  Loader2,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SeoHead } from "@/components/v2/SeoHead";
import { LifetimeProgress } from "@/components/v2/LifetimeProgress";
import { useAuth } from "@/contexts/AuthContext";
import { useLibraryState } from "@/hooks/v2/useLibraryState";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

type Lang = "en" | "ar";

/**
 * V2 authenticated account page.
 *
 * Purpose:
 *  - Show the signed-in user's identity (email, first name if known).
 *  - Show server-authoritative lifetime progress and owned-resource count
 *    (never recomputed from client guesses; sourced from get_my_library_state).
 *  - Provide clear entry points to My Library, Orders/receipts, and, for
 *    admins only, the Admin surface.
 *  - Provide Sign out.
 *
 * Non-goals (explicit):
 *  - No subscription tab, plan picker, or recurring billing UI.
 *  - No favorites / creator marketplace / prompt upload / floating add button.
 *  - No client-side commercial state derivation.
 */
export default function AccountPage() {
  const { user, loading, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const { data: library, isLoading: libraryLoading, isError: libraryError } =
    useLibraryState();
  const { language, isRTL } = useTranslation();
  const lang: Lang = language === "ar" ? "ar" : "en";

  // NOTE: Every Hook (including useMemo below) MUST be called unconditionally
  // before ANY early return. The auth loading → signed-out transition would
  // otherwise change hook order and violate the Rules of Hooks.
  const displayName = useMemo(() => {
    const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
    const first = typeof meta.first_name === "string" ? meta.first_name.trim() : "";
    const last = typeof meta.last_name === "string" ? meta.last_name.trim() : "";
    const username = typeof meta.username === "string" ? meta.username.trim() : "";
    if (first || last) return [first, last].filter(Boolean).join(" ");
    if (username) return username;
    return user?.email ?? "";
  }, [user]);

  // Redirect to login while preserving return path — same helper the rest of
  // V2 uses. Kept inline (small) to avoid an extra hook wrapper import cycle.
  if (!loading && !user) {
    const next = encodeURIComponent(
      `${location.pathname}${location.search || ""}` || "/account",
    );
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  const ownedCount = library?.entitlements?.length ?? 0;
  const hasLibrary = !!library?.has_library_access;
  const progressFils = library?.lifetime_progress_fils ?? 0;

  const t = {
    title: lang === "ar" ? "حسابي" : "My account",
    subtitle:
      lang === "ar"
        ? "ملخّص حسابك ووصول مدى الحياة."
        : "Your account summary and lifetime ownership.",
    identity: lang === "ar" ? "الهوية" : "Identity",
    email: lang === "ar" ? "البريد الإلكتروني" : "Email",
    name: lang === "ar" ? "الاسم" : "Name",
    role: lang === "ar" ? "الصلاحية" : "Role",
    admin: lang === "ar" ? "مشرف" : "Admin",
    lifetime: lang === "ar" ? "وصول مدى الحياة" : "Lifetime access",
    library: lang === "ar" ? "مكتبتي" : "My Library",
    libraryDesc:
      lang === "ar"
        ? "كل الموارد التي تملكها بشكل دائم."
        : "Every resource you permanently own.",
    ownedCount:
      hasLibrary
        ? lang === "ar"
          ? "وصول المكتبة الكاملة مفعّل"
          : "Full library access active"
        : lang === "ar"
          ? `${ownedCount} مورد مملوك`
          : `${ownedCount} owned resource${ownedCount === 1 ? "" : "s"}`,
    ordersTitle: lang === "ar" ? "الطلبات والفواتير" : "Orders & receipts",
    ordersDesc:
      lang === "ar"
        ? "سجّل مشترياتك واستلام إيصالاتك."
        : "Your purchase history and receipts.",
    viewOrders: lang === "ar" ? "عرض الطلبات" : "View orders",
    viewLibrary: lang === "ar" ? "افتح المكتبة" : "Open library",
    adminTitle: lang === "ar" ? "أدوات المشرف" : "Admin tools",
    adminDesc:
      lang === "ar"
        ? "الوصول إلى لوحة إدارة JojoPrompts."
        : "Access the JojoPrompts admin surface.",
    openAdmin: lang === "ar" ? "افتح لوحة المشرف" : "Open admin",
    signOut: lang === "ar" ? "تسجيل الخروج" : "Sign out",
    loading: lang === "ar" ? "جارٍ التحميل…" : "Loading…",
    errorTitle: lang === "ar" ? "تعذّر تحميل الحساب" : "Couldn't load account data",
    errorDesc:
      lang === "ar"
        ? "قد تكون هناك مشكلة مؤقتة. حاول إعادة تحميل الصفحة."
        : "There may be a temporary problem. Try reloading the page.",
    ownership:
      lang === "ar"
        ? "أنت تملك ما اشتريته إلى الأبد. لا اشتراكات."
        : "You permanently own what you buy. No subscriptions.",
  };

  if (loading || (!user && libraryLoading)) {
    return (
      <main
        className="container mx-auto px-4 py-8"
        dir={isRTL ? "rtl" : "ltr"}
        data-testid="v2-account-loading"
      >
        <div
          role="status"
          aria-live="polite"
          className="flex min-h-[240px] items-center justify-center text-muted-foreground"
        >
          <Loader2 className="h-5 w-5 animate-spin me-2" aria-hidden />
          {t.loading}
        </div>
      </main>
    );
  }

  return (
    <main
      className="container mx-auto px-4 py-6 sm:py-10"
      dir={isRTL ? "rtl" : "ltr"}
      data-testid="v2-account-page"
    >
      <SeoHead
        title={lang === "ar" ? "حسابي · JojoPrompts" : "My account · JojoPrompts"}
        description={t.subtitle}
        canonicalPath="/account"
        noindex
      />

      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
        <p className="mt-1 text-xs text-warm-gold">{t.ownership}</p>
      </header>

      <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
        {/* Identity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4 text-warm-gold" aria-hidden />
              {t.identity}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-warm-gold text-white font-medium">
                  {user?.email?.charAt(0).toUpperCase() ?? "U"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="truncate font-medium">{displayName || t.email}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {user?.email}
                </div>
              </div>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Shield className="h-3.5 w-3.5 text-warm-gold" aria-hidden />
                <span>{t.role}: {t.admin}</span>
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => void signOut()}
              className="min-h-[44px] w-full sm:w-auto"
              data-testid="v2-account-signout"
            >
              <LogOut className="h-4 w-4 me-2" aria-hidden />
              {t.signOut}
            </Button>
          </CardContent>
        </Card>

        {/* Lifetime */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-warm-gold" aria-hidden />
              {t.lifetime}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {libraryError ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              >
                <AlertCircle className="h-4 w-4 mt-0.5" aria-hidden />
                <div>
                  <div className="font-medium">{t.errorTitle}</div>
                  <div className="text-xs opacity-80">{t.errorDesc}</div>
                </div>
              </div>
            ) : libraryLoading ? (
              <div className="flex items-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin me-2" aria-hidden />
                {t.loading}
              </div>
            ) : (
              <LifetimeProgress
                progressFils={progressFils}
                hasLibrary={hasLibrary}
              />
            )}
          </CardContent>
        </Card>

        {/* Library */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LibraryBig className="h-4 w-4 text-warm-gold" aria-hidden />
              {t.library}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">{t.libraryDesc}</p>
            <p className="font-medium" data-testid="v2-account-owned-count">
              {libraryLoading ? t.loading : t.ownedCount}
            </p>
            <Button
              asChild
              className="min-h-[44px] w-full bg-warm-gold text-dark-base hover:bg-warm-gold/90 sm:w-auto"
            >
              <Link to="/library">{t.viewLibrary}</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4 text-warm-gold" aria-hidden />
              {t.ordersTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">{t.ordersDesc}</p>
            <Button
              asChild
              variant="outline"
              className="min-h-[44px] w-full sm:w-auto"
            >
              <Link to="/orders">{t.viewOrders}</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Admin — only rendered for admins. */}
        {isAdmin && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4 text-warm-gold" aria-hidden />
                {t.adminTitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">{t.adminDesc}</p>
              <Button
                asChild
                variant="outline"
                className="min-h-[44px] w-full sm:w-auto"
                data-testid="v2-account-admin-link"
              >
                <Link to="/admin">{t.openAdmin}</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
