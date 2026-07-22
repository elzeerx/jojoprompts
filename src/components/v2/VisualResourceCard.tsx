import { Link } from "react-router-dom";
import { Bookmark } from "lucide-react";
import type { ExploreResource } from "@/hooks/v2/useExploreResources";
import { formatKwd } from "@/config/v2Flags";
import { useTranslation } from "@/hooks/useTranslation";

export function VisualResourceCard({ r }: { r: ExploreResource }) {
  const { language } = useTranslation();
  const title = language === "ar" && r.title_ar ? r.title_ar : r.title_en;
  const isFree = r.product?.product_type === "free";
  return (
    <Link
      to={`/resources/${r.slug}`}
      className="group relative block overflow-hidden rounded-2xl border border-border/60 bg-muted focus-visible:ring-2 focus-visible:ring-warm-gold"
    >
      <div className="aspect-square w-full bg-gradient-to-br from-muted to-muted/50">
        {r.hero_image_url ? (
          <img
            src={r.hero_image_url}
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
      <div className="absolute top-2 end-2">
        <span
          aria-label="Save"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-background/90 text-foreground shadow"
        >
          <Bookmark className="h-4 w-4" />
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-3 text-white">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{title}</div>
          <div className="text-[11px] opacity-80 capitalize">{r.type.replace("_", " ")}</div>
        </div>
        <span className="rounded-md bg-background/95 px-2 py-1 text-xs font-medium text-foreground">
          {r.owned ? "Owned" : isFree ? "Free" : `${formatKwd(r.product?.price_fils ?? 0)} KD`}
        </span>
      </div>
    </Link>
  );
}
