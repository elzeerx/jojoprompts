import { useMemo } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useResourceDetail } from "@/hooks/v2/useResourceDetail";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLibraryState } from "@/hooks/v2/useLibraryState";
import { useFreeAcquisition } from "@/hooks/v2/useFreeAcquisition";
import { useNextLoginPath } from "@/hooks/v2/useNextLoginPath";
import { useTranslation } from "@/hooks/useTranslation";
import { formatKwd, safeHeroImageUrl, V2_COMMERCE_ENABLED, V2_COPY } from "@/config/v2Flags";
import { ShieldCheck, Loader2, Timer } from "lucide-react";
import { AddToCartButton } from "@/components/v2/AddToCartButton";

import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  slug: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function QuickPreviewSheet({ slug, open, onOpenChange }: Props) {
  const { data, isLoading, isError } = useResourceDetail(slug ?? undefined);
  const { user } = useAuth();
  const { data: library } = useLibraryState();
  const acquire = useFreeAcquisition();
  const navigate = useNavigate();
  const nextPath = useNextLoginPath();
  const { language } = useTranslation();
  const lang = (language as "en" | "ar") ?? "en";
  const isMobile = useIsMobile();

  const owned = useMemo(() => {
    if (!data?.resource) return false;
    if (library?.has_library_access) return true;
    return (library?.entitlements ?? []).some(
      (e) => e.scope === "resource" && e.resource_id === data.resource.id,
    );
  }, [data, library]);

  const product = data?.products.find((p) => p.is_active) ?? null;
  const isFree = product?.product_type === "free";
  const title = data?.resource
    ? lang === "ar" && data.resource.title_ar
      ? data.resource.title_ar
      : data.resource.title_en
    : "";
  const summary = data?.resource
    ? lang === "ar" && data.resource.summary_ar
      ? data.resource.summary_ar
      : data.resource.summary_en
    : null;
  const heroUrl = safeHeroImageUrl(data?.resource?.hero_image_path ?? null);

  const handleAcquire = () => {
    if (!data?.resource) return;
    if (!user) {
      navigate(nextPath);
      return;
    }
    acquire.mutate(data.resource.id);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={
          isMobile
            ? "h-[92dvh] overflow-y-auto p-0"
            : "w-[440px] sm:max-w-lg overflow-y-auto p-0"
        }
      >
        {isLoading ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : isError || !data?.resource ? (
          <div className="p-6 text-sm text-muted-foreground">
            {V2_COPY.states.error[lang]}
          </div>
        ) : (
          <div>
            {heroUrl ? (
              <img
                src={heroUrl}
                alt=""
                className="h-40 w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-40 w-full items-center justify-center bg-gradient-to-br from-warm-gold/20 to-muted text-4xl font-bold text-warm-gold">
                {title?.charAt(0) ?? "?"}
              </div>
            )}
            <div className="space-y-3 p-6">
              <div className="flex flex-wrap gap-1.5">
                <Badge className="capitalize">{data.resource.type.replace("_", " ")}</Badge>
                {data.version ? (
                  <Badge variant="outline">v{data.version.version}</Badge>
                ) : null}
                {data.trust?.scan_status === "clean" ? (
                  <Badge variant="secondary" className="gap-1">
                    <ShieldCheck className="h-3 w-3" aria-hidden />
                    {V2_COPY.cards.verified[lang]}
                  </Badge>
                ) : null}
                {data.resource.effort_minutes ? (
                  <Badge variant="outline" className="gap-1">
                    <Timer className="h-3 w-3" aria-hidden />
                    {data.resource.effort_minutes} {V2_COPY.cards.minutes[lang]}
                  </Badge>
                ) : null}
              </div>
              <h3 className="text-lg font-semibold">{title}</h3>
              {summary ? (
                <p className="text-sm text-muted-foreground">{summary}</p>
              ) : null}
              {data.platforms.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {data.platforms.map((p) => (
                    <Badge key={p.id} variant="outline" className="capitalize">
                      {p.platform_slug}
                    </Badge>
                  ))}
                </div>
              ) : null}
              <div className="pt-2 text-sm font-medium">
                {owned ? (
                  <span className="text-emerald-600">{V2_COPY.cards.owned[lang]}</span>
                ) : isFree ? (
                  <span className="text-warm-gold">{V2_COPY.cards.free[lang]}</span>
                ) : product ? (
                  <span>{formatKwd(product.price_fils)} KD</span>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button asChild variant="outline" className="min-h-[44px]">
                  <Link to={`/resources/${data.resource.slug}`}>
                    {V2_COPY.cards.viewDetails[lang]}
                  </Link>
                </Button>
                {owned ? (
                  <Button asChild className="min-h-[44px]">
                    <Link to="/library">{V2_COPY.cards.open[lang]}</Link>
                  </Button>
                ) : isFree ? (
                  <Button
                    onClick={handleAcquire}
                    disabled={acquire.isPending}
                    className="min-h-[44px]"
                  >
                    {acquire.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      V2_COPY.cards.addToLibrary[lang]
                    )}
                  </Button>
                ) : product && V2_COMMERCE_ENABLED ? (
                  <AddToCartButton
                    productId={product.id}
                    productType={product.product_type as "individual" | "bundle" | "lifetime" | "free"}
                    titleEn={data.resource.title_en}
                    titleAr={data.resource.title_ar}
                    resourceType={data.resource.type ?? null}
                    size="default"
                  />
                ) : product ? (
                  <Button disabled variant="outline" className="min-h-[44px]">
                    {V2_COPY.cards.checkoutSoon[lang]}
                  </Button>
                ) : null}

              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
