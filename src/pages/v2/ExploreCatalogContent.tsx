import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLibraryState } from "@/hooks/v2/useLibraryState";
import type { ExploreFilters } from "@/hooks/v2/useExploreResources";
import {
  EXPLORE_PAGE_SIZE,
  useInfiniteExploreResources,
} from "@/hooks/v2/useInfiniteExploreResources";
import { SkillResourceCard } from "@/components/v2/SkillResourceCard";
import { VisualResourceCard } from "@/components/v2/VisualResourceCard";
import { ExploreFiltersBar } from "@/components/v2/ExploreFiltersBar";
import { CatalogState } from "@/components/v2/CatalogState";
import { LifetimeProgress } from "@/components/v2/LifetimeProgress";
import { QuickPreviewSheet } from "@/components/v2/QuickPreviewSheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { V2_COPY, type V2ResourceType } from "@/config/v2Flags";
import { useTranslation } from "@/hooks/useTranslation";

type Bilingual = { en: string; ar: string };

interface Props {
  fixedType?: V2ResourceType;
  emptyTitle?: Bilingual;
  emptyDesc?: Bilingual;
  onEmptyCatalogChange: (empty: boolean) => void;
}

const scrollCache = new Map<string, number>();

export function ExploreLifetimeStatus() {
  const { user } = useAuth();
  const { data: library } = useLibraryState();

  if (user && library && !library.has_library_access) {
    return (
      <div className="w-full max-w-xs">
        <LifetimeProgress progressFils={library.lifetime_progress_fils} />
      </div>
    );
  }

  if (user && library?.has_library_access) {
    return (
      <div className="w-full max-w-xs">
        <LifetimeProgress progressFils={0} hasLibrary />
      </div>
    );
  }

  return null;
}

export default function ExploreCatalogContent({
  fixedType,
  emptyTitle,
  emptyDesc,
  onEmptyCatalogChange,
}: Props) {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const { data: library } = useLibraryState();
  const { language, isRTL } = useTranslation();
  const lang = (language as "en" | "ar") ?? "en";
  const scrollKey =
    location.pathname + (params.get("q") ?? "") + (params.get("type") ?? "");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const filters: ExploreFilters = useMemo(
    () => ({
      type: fixedType ?? ((params.get("type") as ExploreFilters["type"]) || "all"),
      platforms:
        (params.get("p")?.split(",").filter(Boolean) as ExploreFilters["platforms"]) ?? [],
      priceMode: (params.get("price") as ExploreFilters["priceMode"]) || "all",
      effort: (params.get("effort") as ExploreFilters["effort"]) || "all",
      search: params.get("q") ?? "",
      sortBy: (params.get("sort") as ExploreFilters["sortBy"]) || "newest",
    }),
    [params, fixedType],
  );

  const ownedIds = useMemo(() => {
    return new Set(library?.owned_resource_ids ?? []);
  }, [library]);

  const {
    data,
    isPending,
    isError,
    refetch,
    isFetched,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteExploreResources(filters, ownedIds, !!library?.has_library_access);

  const rows = useMemo(
    () => (data?.pages ?? []).flatMap((p) => p.rows),
    [data],
  );
  const baseTotal = data?.pages?.[0]?.baseTotal ?? 0;
  const isLoading = isPending;

  // Restore requested page from URL by pulling additional pages until we reach it.
  const targetPage = Math.max(1, Number(params.get("page")) || 1);
  useEffect(() => {
    if (!data) return;
    const loaded = data.pages.length;
    if (loaded < targetPage && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [data, targetPage, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const patch = useCallback(
    (p: Partial<ExploreFilters>) => {
      const next = new URLSearchParams(params);
      if (p.search !== undefined) {
        if (p.search) next.set("q", p.search);
        else next.delete("q");
      }
      if (p.sortBy) next.set("sort", p.sortBy);
      if (p.priceMode) next.set("price", p.priceMode);
      if (p.effort) next.set("effort", p.effort);
      if (p.platforms) {
        if (p.platforms.length) next.set("p", p.platforms.join(","));
        else next.delete("p");
      }
      // Any filter/sort/search change resets to page 1 (no orphan cursors).
      next.delete("page");
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const reset = useCallback(() => {
    const next = new URLSearchParams();
    if (params.get("type")) next.set("type", params.get("type")!);
    setParams(next, { replace: true });
  }, [params, setParams]);

  const loadMore = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    void fetchNextPage().then(() => {
      const next = new URLSearchParams(params);
      const loaded = (data?.pages.length ?? 0) + 1;
      next.set("page", String(loaded));
      setParams(next, { replace: true });
    });
  }, [data, fetchNextPage, hasNextPage, isFetchingNextPage, params, setParams]);

  const [previewSlug, setPreviewSlug] = useState<string | null>(null);
  const rowsMap = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => m.set(r.id, r.slug));
    return m;
  }, [rows]);

  const openPreview = (id: string) => {
    scrollCache.set(scrollKey, window.scrollY);
    setPreviewSlug(rowsMap.get(id) ?? null);
  };

  useEffect(() => {
    if (!isFetched) return;
    const saved = scrollCache.get(scrollKey);
    if (typeof saved === "number") {
      requestAnimationFrame(() => window.scrollTo({ top: saved }));
    }
  }, [isFetched, scrollKey]);

  const structured = rows.filter(
    (r) => r.type === "skill" || r.type === "automation",
  );
  const visual = rows.filter(
    (r) => r.type === "prompt" || r.type === "prompt_pack" || r.type === "image_style",
  );
  const bundles = rows.filter((r) => r.type === "bundle");

  const anyFilter =
    !!filters.search ||
    (filters.platforms?.length ?? 0) > 0 ||
    (filters.priceMode && filters.priceMode !== "all") ||
    (filters.effort && filters.effort !== "all");

  const noResults =
    isFetched && !isLoading && !isError && rows.length === 0 && !!anyFilter;
  const emptyCatalog =
    isFetched && !isLoading && !isError && rows.length === 0 && !anyFilter;

  useEffect(() => {
    onEmptyCatalogChange(emptyCatalog);
  }, [emptyCatalog, onEmptyCatalogChange]);

  const showingLabel =
    lang === "ar"
      ? `عرض ${rows.length} من ${baseTotal}`
      : `Showing ${rows.length} of ${baseTotal}`;
  const loadMoreLabel = lang === "ar" ? "تحميل المزيد" : "Load more";
  const endLabel =
    lang === "ar" ? "لا مزيد من النتائج" : "End of results";

  return (
    <div
      className="space-y-6"
      ref={containerRef}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <ExploreFiltersBar filters={filters} onChange={patch} onReset={reset} />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
      ) : null}

      {isError ? <CatalogState variant="error" onRetry={() => refetch()} /> : null}

      {noResults ? <CatalogState variant="no-results" /> : null}
      {emptyCatalog ? (
        <CatalogState variant="empty" emptyTitle={emptyTitle} emptyDesc={emptyDesc} />
      ) : null}

      {!isLoading && !isError && rows.length > 0 ? (
        <div className="space-y-8">
          <div
            className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"
            aria-live="polite"
            role="status"
            data-testid="explore-count"
          >
            <span>{showingLabel}</span>
          </div>

          {structured.length > 0 ? (
            <section aria-label="Skills and automations">
              <div className="grid gap-4 md:grid-cols-2">
                {structured.map((r) => (
                  <SkillResourceCard key={r.id} r={r} onQuickPreview={openPreview} />
                ))}
              </div>
            </section>
          ) : null}
          {visual.length > 0 ? (
            <section aria-label="Prompts and image styles">
              <h2 className="mb-3 text-lg font-semibold">
                {V2_COPY.nav.prompts[lang]} & {V2_COPY.nav.imageStyles[lang]}
              </h2>
              <div
                className="columns-2 gap-3 md:columns-3 lg:columns-4"
                data-testid="visual-masonry"
              >
                {visual.map((r) => (
                  <VisualResourceCard key={r.id} r={r} onQuickPreview={openPreview} />
                ))}
              </div>
            </section>
          ) : null}
          {bundles.length > 0 ? (
            <section aria-label="Bundles">
              <h2 className="mb-3 text-lg font-semibold">
                {V2_COPY.nav.bundles[lang]}
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {bundles.map((r) => (
                  <SkillResourceCard key={r.id} r={r} onQuickPreview={openPreview} />
                ))}
              </div>
            </section>
          ) : null}

          <div className="flex justify-center pt-4">
            {hasNextPage ? (
              <Button
                type="button"
                variant="outline"
                onClick={loadMore}
                disabled={isFetchingNextPage}
                className="min-h-[44px] min-w-[160px]"
                data-testid="explore-load-more"
                aria-label={loadMoreLabel}
              >
                {isFetchingNextPage ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  loadMoreLabel
                )}
              </Button>
            ) : (
              <span
                className="text-xs text-muted-foreground"
                data-testid="explore-end"
              >
                {endLabel} · {baseTotal}
              </span>
            )}
          </div>
        </div>
      ) : null}

      <QuickPreviewSheet
        slug={previewSlug}
        open={!!previewSlug}
        onOpenChange={(v) => (v ? null : setPreviewSlug(null))}
      />
    </div>
  );
}
