import { Link, useNavigate } from "react-router-dom";
import { Info, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import type { ExploreResource } from "@/hooks/v2/useExploreResources";
import { formatKwd, V2_COPY } from "@/config/v2Flags";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/contexts/AuthContext";
import { useFreeAcquisition } from "@/hooks/v2/useFreeAcquisition";
import { useNextLoginPath } from "@/hooks/v2/useNextLoginPath";
import { AddToCartButton } from "@/components/v2/AddToCartButton";
import { Button } from "@/components/ui/button";
import { formatShortDate, ownershipLabel, trustBadge } from "@/components/v2/cardMetadata";
import { useHeroImageUrl } from "@/hooks/v2/useHeroImageUrl";

interface Props {
  r: ExploreResource;
  onQuickPreview?: (id: string) => void;
}

export function VisualResourceCard({ r, onQuickPreview }: Props) {
  const { language } = useTranslation();
  const lang = (language as "en" | "ar") ?? "en";
  const { user } = useAuth();
  const navigate = useNavigate();
  const acquire = useFreeAcquisition();
  const nextPath = useNextLoginPath();

  const title = lang === "ar" && r.title_ar ? r.title_ar : r.title_en;
  const isFree = r.product?.product_type === "free";
  const { url: heroUrl, isLoading: isHeroLoading } = useHeroImageUrl(
    r.hero_image_path,
    640,
    82,
  );

  const ownership = ownershipLabel(r, lang, formatKwd);
  const priceBadge = ownership.text;
  const tb = trustBadge(r, lang);
  const TrustIcon = tb.tone === "verified" ? ShieldCheck : ShieldAlert;
  const updated = formatShortDate(
    r.current_version?.updated_at ?? r.updated_at,
    lang,
  );
  const heroAspect =
    r.type === "image_style"
      ? "aspect-[4/5]"
      : r.type === "prompt_pack"
        ? "aspect-[3/4]"
        : "aspect-[4/3]";

  const stopPropagation = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };


  return (
    <div className="group relative mb-3 inline-block w-full break-inside-avoid">
      {/* Card link — no nested interactive markup inside. Overlays are siblings. */}
      <Link
        to={`/resources/${r.slug}`}
        className="relative block overflow-hidden rounded-2xl border border-border/60 bg-muted focus-visible:ring-2 focus-visible:ring-warm-gold"
        aria-label={title ?? undefined}
      >
        <div className={`${heroAspect} w-full bg-gradient-to-br from-muted to-muted/50`}>
          {heroUrl ? (
            <img
              src={heroUrl}
              alt={title ?? ""}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : isHeroLoading ? (
            <div className="h-full w-full animate-pulse bg-muted" aria-hidden="true" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-warm-gold/60">
              {title?.charAt(0) ?? "?"}
            </div>
          )}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-3 text-white">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{title}</div>
            <div className="text-[11px] opacity-80 capitalize">
              {r.type.replace("_", " ")}
              {r.effort_minutes
                ? ` · ${r.effort_minutes} ${V2_COPY.cards.minutes[lang]}`
                : ""}
            </div>
          </div>
          <span
            className="rounded-md bg-background/95 px-2 py-1 text-xs font-medium text-foreground"
            data-testid="ownership-label"
          >
            {priceBadge}
          </span>
        </div>
      </Link>

      {/* Truthful metadata footer: version, updated date, trust state.
          Missing values collapse to a neutral "Not specified" chip. */}
      <div className="mt-2 flex flex-wrap items-center gap-2 px-1 text-[11px] text-muted-foreground">
        <span data-testid="version-label">
          {r.current_version ? `v${r.current_version.version}` : `v${V2_COPY.cards.notSpecified[lang]}`}
        </span>
        {updated ? (
          <span data-testid="updated-on">
            {V2_COPY.cards.updated[lang]}: {updated}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1" data-testid={`trust-${tb.tone}`}>
          <TrustIcon className="h-3 w-3" aria-hidden />
          {tb.label}
        </span>
      </div>


      {/* Overlay actions — sibling of the link; block bubbling so the tile
          navigation never fires when interacting with these controls. */}
      <div
        className="absolute top-2 end-2 flex items-center gap-1"
        onClick={stopPropagation}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") stopPropagation(e);
        }}
      >
        {r.owned ? (
          <Button asChild size="sm" variant="secondary" className="min-h-[44px] shadow">
            <Link to="/library">{V2_COPY.cards.open[lang]}</Link>
          </Button>
        ) : isFree ? (
          <Button
            size="sm"
            className="min-h-[44px] shadow"
            disabled={acquire.isPending}
            onClick={(e) => {
              stopPropagation(e);
              if (!user) {
                navigate(nextPath);
                return;
              }
              acquire.mutate(r.id);
            }}
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
            className="min-h-[44px] shadow"
            aria-label={lang === "ar" ? "غير متاح" : "Unavailable"}
          >
            {lang === "ar" ? "غير متاح" : "Unavailable"}
          </Button>
        )}

        {onQuickPreview ? (
          <button
            type="button"
            onClick={(e) => {
              stopPropagation(e);
              onQuickPreview(r.id);
            }}
            aria-label={V2_COPY.cards.quickPreview[lang]}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-background/90 text-foreground shadow touch-manipulation focus-visible:ring-2 focus-visible:ring-warm-gold md:h-9 md:w-9"
          >
            <Info className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}
