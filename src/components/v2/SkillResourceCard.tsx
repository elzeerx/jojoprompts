import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, Loader2, Timer, Info, Calendar } from "lucide-react";
import type { ExploreResource } from "@/hooks/v2/useExploreResources";
import { formatKwd, V2_COPY } from "@/config/v2Flags";
import { useAuth } from "@/contexts/AuthContext";
import { useFreeAcquisition } from "@/hooks/v2/useFreeAcquisition";
import { useTranslation } from "@/hooks/useTranslation";
import { useNextLoginPath } from "@/hooks/v2/useNextLoginPath";
import { AddToCartButton } from "@/components/v2/AddToCartButton";
import { formatShortDate, ownershipLabel, trustBadge } from "@/components/v2/cardMetadata";



interface Props {
  r: ExploreResource;
  onQuickPreview?: (id: string) => void;
}

export function SkillResourceCard({ r, onQuickPreview }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const acquire = useFreeAcquisition();
  const { language } = useTranslation();
  const lang = (language as "en" | "ar") ?? "en";
  const nextPath = useNextLoginPath();
  const title = lang === "ar" && r.title_ar ? r.title_ar : r.title_en;
  const summary = lang === "ar" && r.summary_ar ? r.summary_ar : r.summary_en;

  const isFree = r.product?.product_type === "free";
  const priceLabel =
    r.product && !isFree ? `${formatKwd(r.product.price_fils)} KD` : null;

  const handleAcquire = () => {
    if (!user) {
      navigate(nextPath);
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
            {onQuickPreview ? (
              <button
                type="button"
                aria-label={V2_COPY.cards.quickPreview[lang]}
                onClick={() => onQuickPreview(r.id)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-warm-gold min-h-[44px] min-w-[44px]"
              >
                <Info className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <Badge variant="outline" className="capitalize">
              {r.type.replace("_", " ")}
            </Badge>
            {r.platforms.length > 0 ? (
              r.platforms.slice(0, 3).map((p) => (
                <Badge key={p} variant="secondary" className="capitalize">
                  {p}
                </Badge>
              ))
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                {V2_COPY.cards.notSpecified[lang]}
              </Badge>
            )}
            {r.current_version ? (
              <Badge variant="outline">v{r.current_version.version}</Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                v{V2_COPY.cards.notSpecified[lang]}
              </Badge>
            )}
            {r.effort_minutes ? (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Timer className="h-3 w-3" aria-hidden />
                {r.effort_minutes} {V2_COPY.cards.minutes[lang]}
              </span>
            ) : null}
            {(() => {
              const tb = trustBadge(r, lang);
              const Icon = tb.tone === "verified" ? ShieldCheck : ShieldAlert;
              return (
                <span
                  className="inline-flex items-center gap-1 text-muted-foreground"
                  data-testid={`trust-${tb.tone}`}
                >
                  <Icon className="h-3 w-3" aria-hidden />
                  {tb.label}
                </span>
              );
            })()}
            {(() => {
              const iso = r.current_version?.updated_at ?? r.updated_at;
              const label = formatShortDate(iso, lang);
              return label ? (
                <span
                  className="inline-flex items-center gap-1 text-muted-foreground"
                  data-testid="updated-on"
                >
                  <Calendar className="h-3 w-3" aria-hidden />
                  {V2_COPY.cards.updated[lang]}: {label}
                </span>
              ) : null;
            })()}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="text-sm font-medium" data-testid="ownership-label">
              {(() => {
                const o = ownershipLabel(r, lang, formatKwd);
                const cls =
                  o.kind === "lifetime"
                    ? "text-warm-gold"
                    : o.kind === "owned"
                      ? "text-emerald-600"
                      : o.kind === "free"
                        ? "text-warm-gold"
                        : o.kind === "unknown"
                          ? "text-muted-foreground"
                          : "";
                return <span className={cls}>{o.text}</span>;
              })()}
            </div>

            {r.owned ? (
              <Button asChild size="sm" variant="outline" className="min-h-[44px]">
                <Link to={`/resources/${r.slug}`}>{V2_COPY.cards.open[lang]}</Link>
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
                  V2_COPY.cards.addToLibrary[lang]
                )}
              </Button>
            ) : r.product ? (
              <AddToCartButton
                productId={r.product.id}
                productType={r.product.product_type as "individual" | "bundle" | "lifetime" | "free"}
                titleEn={r.title_en}
                titleAr={r.title_ar}
                resourceType={r.type ?? null}
              />
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled
                className="min-h-[44px]"
                aria-label={lang === "ar" ? "غير متاح" : "Unavailable"}
              >
                {lang === "ar" ? "غير متاح" : "Unavailable"}
              </Button>
            )}


          </div>
        </div>
      </div>
    </article>
  );
}
