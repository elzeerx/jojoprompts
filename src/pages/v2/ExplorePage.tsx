import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLibraryState } from "@/hooks/v2/useLibraryState";
import { useExploreResources, type ExploreFilters } from "@/hooks/v2/useExploreResources";
import { SkillResourceCard } from "@/components/v2/SkillResourceCard";
import { VisualResourceCard } from "@/components/v2/VisualResourceCard";
import { ExploreFiltersBar } from "@/components/v2/ExploreFiltersBar";
import { CatalogState } from "@/components/v2/CatalogState";
import { LifetimeProgress } from "@/components/v2/LifetimeProgress";
import { QuickPreviewSheet } from "@/components/v2/QuickPreviewSheet";
import { SeoHead } from "@/components/v2/SeoHead";
import { Skeleton } from "@/components/ui/skeleton";
import { V2_COPY, type V2ResourceType } from "@/config/v2Flags";
import { useTranslation } from "@/hooks/useTranslation";

interface Props {
  fixedType?: V2ResourceType;
  title?: string;
  emptyTitle?: { en: string; ar: string };
  emptyDesc?: { en: string; ar: string };
  seoTitle?: { en: string; ar: string };
  seoDescription?: { en: string; ar: string };
  canonicalPath?: string;
}

// Simple in-memory scroll cache keyed by (path+search minus the preview slug)
const scrollCache = new Map<string, number>();

export default function ExplorePage({
  fixedType,
  title,
  emptyTitle,
  emptyDesc,
  seoTitle,
  seoDescription,
  canonicalPath,
}: Props) {
  const { user } = useAuth();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const { data: library } = useLibraryState();
  const { language, isRTL } = useTranslation();
  const lang = (language as "en" | "ar") ?? "en";
  const scrollKey = location.pathname + (params.get("q") ?? "") + (params.get("type") ?? "");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const filters: ExploreFilters = useMemo(
    () => ({
      type: fixedType ?? ((params.get("type") as ExploreFilters["type"]) || "all"),
      platforms: (params.get("p")?.split(",").filter(Boolean) as ExploreFilters["platforms"]) ?? [],
      priceMode: (params.get("price") as ExploreFilters["priceMode"]) || "all",
      effort: (params.get("effort") as ExploreFilters["effort"]) || "all",
      search: params.get("q") ?? "",
      sortBy: (params.get("sort") as ExploreFilters["sortBy"]) || "newest",
    }),
    [params, fixedType],
  );

  const ownedIds = useMemo(() => {
    const s = new Set<string>();
    (library?.entitlements ?? []).forEach((e) => {
      if (e.scope === "resource" && e.resource_id) s.add(e.resource_id);
    });
    return s;
  }, [library]);

  const { data: rows, isLoading, isError, refetch, isFetched } = useExploreResources(
    filters,
    ownedIds,
    !!library?.has_library_access,
  );

  const patch = useCallback(
    (p: Partial<ExploreFilters>) => {
      const next = new URLSearchParams(params);
      if (p.search !== undefined) p.search ? next.set("q", p.search) : next.delete("q");
      if (p.sortBy) next.set("sort", p.sortBy);
      if (p.priceMode) next.set("price", p.priceMode);
      if (p.effort) next.set("effort", p.effort);
      if (p.platforms)
        p.platforms.length ? next.set("p", p.platforms.join(",")) : next.delete("p");
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const reset = useCallback(() => {
    const next = new URLSearchParams();
    if (params.get("type")) next.set("type", params.get("type")!);
    setParams(next, { replace: true });
  }, [params, setParams]);

  const [previewSlug, setPreviewSlug] = useState<string | null>(null);
  const rowsMap = useMemo(() => {
    const m = new Map<string, string>();
    (rows ?? []).forEach((r) => m.set(r.id, r.slug));
    return m;
  }, [rows]);

  const openPreview = (id: string) => {
    scrollCache.set(scrollKey, window.scrollY);
    setPreviewSlug(rowsMap.get(id) ?? null);
  };

  // Restore scroll after data has loaded
  useEffect(() => {
    if (!isFetched) return;
    const saved = scrollCache.get(scrollKey);
    if (typeof saved === "number") {
      requestAnimationFrame(() => window.scrollTo({ top: saved }));
    }
  }, [isFetched, scrollKey]);

  const structured = (rows ?? []).filter(
    (r) => r.type === "skill" || r.type === "automation",
  );
  const visual = (rows ?? []).filter(
    (r) => r.type === "prompt" || r.type === "prompt_pack" || r.type === "image_style",
  );
  const bundles = (rows ?? []).filter((r) => r.type === "bundle");

  const noResults =
    isFetched && !isLoading && !isError && (rows?.length ?? 0) === 0 &&
    (filters.search || (filters.platforms?.length ?? 0) > 0 ||
      (filters.priceMode && filters.priceMode !== "all") ||
      (filters.effort && filters.effort !== "all"));

  const emptyCatalog =
    isFetched && !isLoading && !isError && (rows?.length ?? 0) === 0 && !noResults;

  const pageTitle = title ?? V2_COPY.nav.explore[lang];
  const resolvedTitle = seoTitle
    ? `${seoTitle[lang]} · JojoPrompts`
    : `${pageTitle} · JojoPrompts`;
  const resolvedDesc = seoDescription
    ? seoDescription[lang]
    : V2_COPY.explore.subtitle[lang];

  return (
    <div className="min-h-screen bg-background" ref={containerRef} dir={isRTL ? "rtl" : "ltr"}>
      <SeoHead
        title={resolvedTitle}
        description={resolvedDesc}
        canonicalPath={canonicalPath ?? location.pathname}
        noindex={emptyCatalog}
      />
      <main className="container mx-auto px-4 py-6 space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">{pageTitle}</h1>
            <p className="text-sm text-muted-foreground">
              {V2_COPY.explore.subtitle[lang]}
            </p>
          </div>
          {user && library && !library.has_library_access ? (
            <div className="w-full max-w-xs">
              <LifetimeProgress progressFils={library.lifetime_progress_fils} />
            </div>
          ) : null}
          {user && library?.has_library_access ? (
            <div className="w-full max-w-xs">
              <LifetimeProgress progressFils={0} hasLibrary />
            </div>
          ) : null}
        </header>

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

        {!isLoading && !isError && (rows?.length ?? 0) > 0 ? (
          <div className="space-y-8">
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
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
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
          </div>
        ) : null}
      </main>

      <QuickPreviewSheet
        slug={previewSlug}
        open={!!previewSlug}
        onOpenChange={(v) => (v ? null : setPreviewSlug(null))}
      />
    </div>
  );
}
