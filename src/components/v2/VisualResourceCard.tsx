import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import type { ExploreResource } from "@/hooks/v2/useExploreResources";
import { formatKwd, V2_COPY } from "@/config/v2Flags";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/contexts/AuthContext";
import { useFreeAcquisition } from "@/hooks/v2/useFreeAcquisition";
import { useNextLoginPath } from "@/hooks/v2/useNextLoginPath";
import { AddToCartButton } from "@/components/v2/AddToCartButton";
import { Button } from "@/components/ui/button";
import { useHeroImageUrl } from "@/hooks/v2/useHeroImageUrl";

interface Props {
  r: ExploreResource;
  onQuickPreview?: (id: string) => void;
}

/** Localized, human-readable resource type labels (no raw enum values). */
const RESOURCE_TYPE_LABELS: Record<string, { en: string; ar: string }> = {
  image_style: { en: "Image style", ar: "نمط صورة" },
  prompt: { en: "Prompt", ar: "برومبت" },
  prompt_pack: { en: "Prompt pack", ar: "حزمة برومبتات" },
};

function resourceTypeLabel(
  type: string | null | undefined,
  lang: "en" | "ar",
): string {
  if (!type) return "";
  const known = RESOURCE_TYPE_LABELS[type];
  if (known) return known[lang];
  return lang === "ar" ? "" : type.replace(/_/g, " ");
}


/**
 * Option 2 — "Quiet editorial caption".
 * The image is unobstructed (no overlays, gradients, chips or footers);
 * all metadata lives in a quiet caption below it.
 */
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

  const typeLabel = resourceTypeLabel(r.type, lang);
  const priceLabel = r.product
    ? lang === "ar"
      ? `${formatKwd(r.product.price_fils)} د.ك`
      : `${formatKwd(r.product.price_fils)} KD`
    : null;



  const heroAspect =
    r.type === "image_style"
      ? "aspect-[4/5]"
      : r.type === "prompt_pack"
        ? "aspect-[3/4]"
        : "aspect-[4/3]";

  const previewLabel =
    lang === "ar" ? `معاينة سريعة: ${title}` : `Quick preview: ${title}`;
  const detailsLabel =
    lang === "ar" ? `عرض التفاصيل: ${title}` : `View details: ${title}`;

  const media = (
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
  );

  const mediaClass =
    "block w-full overflow-hidden rounded-2xl border border-border/60 bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-gold";

  return (
    <div className="group mb-3 inline-block w-full break-inside-avoid md:mb-4">
      {onQuickPreview ? (
        <button
          type="button"
          className={`${mediaClass} touch-manipulation`}
          aria-label={previewLabel}
          data-testid="visual-card-media"
          onClick={() => onQuickPreview(r.id)}
        >
          {media}
        </button>
      ) : (
        <Link
          to={`/resources/${r.slug}`}
          className={mediaClass}
          aria-label={detailsLabel}
          data-testid="visual-card-media"
        >
          {media}
        </Link>
      )}

      {/* Quiet editorial caption — stacks on narrow cards, two columns at sm+ */}
      <div
        className="mt-2 grid grid-cols-1 items-start gap-2 px-0.5 sm:grid-cols-[minmax(0,1fr)_auto]"
        data-testid="visual-resource-caption"
      >
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground" data-testid="caption-title">
            {title}
          </div>
          <div className="truncate text-[11px] text-muted-foreground" data-testid="caption-type">
            {typeLabel}
          </div>
        </div>

        <div className="min-w-0 justify-self-start sm:justify-self-end">

          {r.owned ? (
            <Button asChild size="sm" variant="outline" className="min-h-[44px]">
              <Link to="/library">
                {r.ownedVia === "library"
                  ? V2_COPY.cards.includedLifetime[lang]
                  : V2_COPY.cards.owned[lang]}
              </Link>
            </Button>
          ) : isFree ? (
            <Button
              size="sm"
              variant="outline"
              className="min-h-[44px]"
              disabled={acquire.isPending}
              onClick={() => {
                if (!user) {
                  navigate(nextPath);
                  return;
                }
                acquire.mutate(r.id);
              }}
              aria-label={`${V2_COPY.cards.free[lang]}: ${title}`}
            >
              {acquire.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                V2_COPY.cards.free[lang]
              )}
            </Button>
          ) : r.product ? (
            <AddToCartButton
              productId={r.product.id}
              productType={r.product.product_type as "individual" | "bundle" | "lifetime" | "free"}
              titleEn={r.title_en}
              titleAr={r.title_ar}
              resourceType={r.type ?? null}
              appearance="compact"
              priceLabel={priceLabel ?? undefined}
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
  );
}
