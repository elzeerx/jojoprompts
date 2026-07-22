import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLibraryState } from "@/hooks/v2/useLibraryState";
import { useExploreResources, type ExploreFilters } from "@/hooks/v2/useExploreResources";
import { SkillResourceCard } from "@/components/v2/SkillResourceCard";
import { VisualResourceCard } from "@/components/v2/VisualResourceCard";
import { ExploreFiltersBar } from "@/components/v2/ExploreFiltersBar";
import { EmptyCatalog } from "@/components/v2/EmptyCatalog";
import { LifetimeProgress } from "@/components/v2/LifetimeProgress";
import { V2SubNav } from "@/components/v2/V2SubNav";
import { Skeleton } from "@/components/ui/skeleton";
import type { V2ResourceType } from "@/config/v2Flags";

interface Props {
  fixedType?: V2ResourceType;
  title?: string;
}

export default function ExplorePage({ fixedType, title }: Props) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const { data: library } = useLibraryState();

  const filters: ExploreFilters = useMemo(
    () => ({
      type: fixedType ?? ((params.get("type") as any) || "all"),
      platforms: params.get("p")?.split(",").filter(Boolean) as any,
      priceMode: (params.get("price") as any) || "all",
      search: params.get("q") ?? "",
      sortBy: (params.get("sort") as any) || "newest",
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

  const { data: rows, isLoading, isError, refetch } = useExploreResources(
    filters,
    ownedIds,
    !!library?.has_library_access,
  );

  useEffect(() => {
    document.title = `${title ?? "Explore"} · JojoPrompts`;
  }, [title]);

  const patch = (p: Partial<ExploreFilters>) => {
    const next = new URLSearchParams(params);
    if (p.search !== undefined) p.search ? next.set("q", p.search) : next.delete("q");
    if (p.sortBy) next.set("sort", p.sortBy);
    if (p.priceMode) next.set("price", p.priceMode);
    if (p.platforms) p.platforms.length ? next.set("p", p.platforms.join(",")) : next.delete("p");
    setParams(next, { replace: true });
  };

  const structured = (rows ?? []).filter(
    (r) => r.type === "skill" || r.type === "automation",
  );
  const visual = (rows ?? []).filter(
    (r) => r.type === "prompt" || r.type === "image_style",
  );
  const bundles = (rows ?? []).filter((r) => r.type === "bundle");

  return (
    <div className="min-h-screen bg-background">
      <V2SubNav authed={!!user} />
      <main className="container mx-auto px-4 py-6 space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">{title ?? "Explore"}</h1>
            <p className="text-sm text-muted-foreground">
              Verified Jojo resources for your workflow.
            </p>
          </div>
          {user && library && !library.has_library_access && (
            <div className="w-full max-w-xs">
              <LifetimeProgress progressFils={library.lifetime_progress_fils} />
            </div>
          )}
          {user && library?.has_library_access && (
            <div className="w-full max-w-xs">
              <LifetimeProgress progressFils={0} hasLibrary />
            </div>
          )}
        </header>

        <ExploreFiltersBar filters={filters} onChange={patch} />

        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-2xl" />
            ))}
          </div>
        )}

        {isError && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center">
            <p className="text-sm">Something went wrong loading the catalog.</p>
            <button
              onClick={() => refetch()}
              className="mt-3 rounded-md bg-warm-gold px-4 py-2 text-sm font-medium text-dark-base min-h-[44px]"
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !isError && (rows?.length ?? 0) === 0 && <EmptyCatalog />}

        {!isLoading && !isError && (rows?.length ?? 0) > 0 && (
          <div className="space-y-8">
            {structured.length > 0 && (
              <section aria-label="Skills and automations">
                <div className="grid gap-4 md:grid-cols-2">
                  {structured.map((r) => (
                    <SkillResourceCard key={r.id} r={r} />
                  ))}
                </div>
              </section>
            )}
            {visual.length > 0 && (
              <section aria-label="Prompts and image styles">
                <h2 className="mb-3 text-lg font-semibold">Prompts & Image Styles</h2>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {visual.map((r) => (
                    <VisualResourceCard key={r.id} r={r} />
                  ))}
                </div>
              </section>
            )}
            {bundles.length > 0 && (
              <section aria-label="Bundles">
                <h2 className="mb-3 text-lg font-semibold">Bundles</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {bundles.map((r) => (
                    <SkillResourceCard key={r.id} r={r} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
