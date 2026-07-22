import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bookmark, ShieldCheck, Loader2 } from "lucide-react";
import type { ExploreResource } from "@/hooks/v2/useExploreResources";
import { V2_COMMERCE_ENABLED, formatKwd } from "@/config/v2Flags";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useFreeAcquisition } from "@/hooks/v2/useFreeAcquisition";
import { useTranslation } from "@/hooks/useTranslation";

export function SkillResourceCard({ r }: { r: ExploreResource }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const acquire = useFreeAcquisition();
  const { language } = useTranslation();
  const title = language === "ar" && r.title_ar ? r.title_ar : r.title_en;
  const summary = language === "ar" && r.summary_ar ? r.summary_ar : r.summary_en;

  const isFree = r.product?.product_type === "free";
  const priceLabel =
    r.product && !isFree ? `${formatKwd(r.product.price_fils)} KD` : null;

  const handleAcquire = () => {
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
      return;
    }
    acquire.mutate(r.id);
  };

  return (
    <article className="group rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:border-warm-gold/50">
      <div className="flex gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-muted text-2xl font-bold text-warm-gold">
          {title?.charAt(0) ?? "?"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                to={`/resources/${r.slug}`}
                className="block truncate text-base font-semibold hover:text-warm-gold focus-visible:underline"
              >
                {title}
              </Link>
              {summary && (
                <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                  {summary}
                </p>
              )}
            </div>
            <button
              aria-label="Save"
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-warm-gold min-h-[44px] min-w-[44px]"
            >
              <Bookmark className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            {r.platforms.slice(0, 3).map((p) => (
              <Badge key={p} variant="secondary" className="capitalize">
                {p}
              </Badge>
            ))}
            {r.current_version && (
              <Badge variant="outline">v{r.current_version.version}</Badge>
            )}
            {r.trust?.scan_status === "clean" && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <ShieldCheck className="h-3 w-3" />
                Verified
              </span>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="text-sm font-medium">
              {r.owned ? (
                <span className="text-emerald-600">Owned</span>
              ) : isFree ? (
                <span className="text-warm-gold">Free</span>
              ) : (
                <span>{priceLabel}</span>
              )}
            </div>
            {r.owned ? (
              <Button asChild size="sm" variant="outline">
                <Link to={`/resources/${r.slug}`}>Open</Link>
              </Button>
            ) : isFree ? (
              <Button
                size="sm"
                onClick={handleAcquire}
                disabled={acquire.isPending}
                className="min-h-[44px]"
              >
                {acquire.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Add to library"
                )}
              </Button>
            ) : V2_COMMERCE_ENABLED ? (
              <Button asChild size="sm" className="min-h-[44px]">
                <Link to={`/resources/${r.slug}`}>View details</Link>
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled
                title="Checkout coming next"
                className="min-h-[44px]"
              >
                Checkout coming
              </Button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
