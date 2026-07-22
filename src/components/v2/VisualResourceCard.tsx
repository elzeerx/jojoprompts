import { Link } from "react-router-dom";
import { Info } from "lucide-react";
import type { ExploreResource } from "@/hooks/v2/useExploreResources";
import { formatKwd, safeHeroImageUrl, V2_COPY } from "@/config/v2Flags";
import { useTranslation } from "@/hooks/useTranslation";

interface Props {
  r: ExploreResource;
  onQuickPreview?: (id: string) => void;
}

export function VisualResourceCard({ r, onQuickPreview }: Props) {
  const { language } = useTranslation();
  const lang = (language as "en" | "ar") ?? "en";
  const title = lang === "ar" && r.title_ar ? r.title_ar : r.title_en;
  const isFree = r.product?.product_type === "free";
  const heroUrl = safeHeroImageUrl(r.hero_image_path);

  const priceBadge = r.owned
    ? V2_COPY.cards.owned[lang]
    : isFree
      ? V2_COPY.cards.free[lang]
      : `${formatKwd(r.product?.price_fils ?? 0)} KD`;

  return (
    <div className="group relative">
      <Link
        to={`/resources/${r.slug}`}
        className="block overflow-hidden rounded-2xl border border-border/60 bg-muted focus-visible:ring-2 focus-visible:ring-warm-gold"
        aria-label={title ?? undefined}
      >
        <div className="aspect-square w-full bg-gradient-to-br from-muted to-muted/50">
          {heroUrl ? (
            <img
              src={heroUrl}
              alt={title ?? ""}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-warm-gold/60">
              {title?.charAt(0) ?? "?"}
            </div>
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-3 text-white">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{title}</div>
            <div className="text-[11px] opacity-80 capitalize">
              {r.type.replace("_", " ")}
              {r.effort_minutes
                ? ` · ${r.effort_minutes} ${V2_COPY.cards.minutes[lang]}`
                : ""}
            </div>
          </div>
          <span className="rounded-md bg-background/95 px-2 py-1 text-xs font-medium text-foreground">
            {priceBadge}
          </span>
        </div>
      </Link>
      {onQuickPreview ? (
        <button
          type="button"
          onClick={() => onQuickPreview(r.id)}
          aria-label={V2_COPY.cards.quickPreview[lang]}
          className="absolute top-2 end-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-background/90 text-foreground shadow focus-visible:ring-2 focus-visible:ring-warm-gold"
        >
          <Info className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
