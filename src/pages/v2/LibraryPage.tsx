import { useEffect, useMemo, useState } from "react";
import { Navigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLibraryState } from "@/hooks/v2/useLibraryState";
import { useDownloadableFiles, type DownloadableFile } from "@/hooks/v2/useDownloadableFiles";
import { useResourceDownload } from "@/hooks/v2/useResourceDownload";
import { useInactiveEntitlements } from "@/hooks/v2/useInactiveEntitlements";
import { useMyLegacyAccessSummary } from "@/hooks/v2/useMyLegacyAccessSummary";
import { LifetimeProgress } from "@/components/v2/LifetimeProgress";
import { LegacyAccessSummary } from "@/components/v2/LegacyAccessSummary";
import { SeoHead } from "@/components/v2/SeoHead";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { V2_COPY, V2_RESOURCE_TYPES, type V2ResourceType } from "@/config/v2Flags";

type Lang = "en" | "ar";

interface LibraryResourceRow {
  id: string;
  slug: string;
  type: V2ResourceType;
  title_en: string;
  title_ar: string | null;
  lifecycle: "draft" | "review" | "published" | "archived";
}

const TABS: Array<{ id: "all" | V2ResourceType; labelKey: keyof typeof V2_COPY.nav | "all" }> = [
  { id: "all", labelKey: "all" },
  { id: "skill", labelKey: "skills" },
  { id: "automation", labelKey: "automations" },
  { id: "prompt", labelKey: "prompts" },
  { id: "prompt_pack", labelKey: "promptPacks" },
  { id: "image_style", labelKey: "imageStyles" },
  { id: "bundle", labelKey: "bundles" },
];

function tabLabel(id: string, lang: Lang): string {
  if (id === "all") return lang === "ar" ? "الكل" : "All";
  const entry = TABS.find((t) => t.id === id);
  if (!entry || entry.labelKey === "all") return id;
  return V2_COPY.nav[entry.labelKey][lang];
}

export default function LibraryPage() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { data: library, isLoading, isError, refetch } = useLibraryState();
  const { data: files, isLoading: filesLoading } = useDownloadableFiles();
  const { data: inactive } = useInactiveEntitlements();
  const { data: legacySummary } = useMyLegacyAccessSummary();
  const download = useResourceDownload();
  const { language, isRTL } = useTranslation();
  const lang: Lang = language === "ar" ? "ar" : "en";
  const [tab, setTab] = useState<string>("all");

  useEffect(() => {
    document.title = "My Library · JojoPrompts";
  }, []);

  const hasLegacyLifetime = !!legacySummary?.lifetime;
  const hasLibrary = !!library?.has_library_access || hasLegacyLifetime;
  const entitledIds = useMemo(() => {
    const ids: string[] = [];
    (library?.entitlements ?? []).forEach((e) => {
      if (e.scope === "resource" && e.resource_id) ids.push(e.resource_id);
    });
    return ids;
  }, [library]);
  const stableEntitledKey = useMemo(
    () => [...entitledIds].sort().join(","),
    [entitledIds],
  );

  const {
    data: resources,
    isLoading: resourcesLoading,
    isError: resourcesError,
    refetch: refetchResources,
  } = useQuery<LibraryResourceRow[]>({
    queryKey: ["v2", "library-resources", hasLibrary ? "library" : stableEntitledKey],
    enabled: !loading && !!user && (hasLibrary || entitledIds.length > 0),
    queryFn: async () => {
      let query = supabase
        .from("resources")
        .select("id, slug, type, title_en, title_ar, lifecycle")
        .in("lifecycle", ["published", "archived"]);
      if (!hasLibrary) query = query.in("id", entitledIds);
      const { data, error } = await query.order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LibraryResourceRow[];
    },
  });

  if (!loading && !user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  const filesByResource = useMemo(() => {
    const map = new Map<string, DownloadableFile[]>();
    (files ?? []).forEach((f) => {
      const list = map.get(f.resource_id) ?? [];
      list.push(f);
      map.set(f.resource_id, list);
    });
    return map;
  }, [files]);

  const filtered = (resources ?? []).filter(
    (r) => tab === "all" || r.type === tab,
  );

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? "rtl" : "ltr"}>
      <SeoHead
        title={`${V2_COPY.library.title[lang]} · JojoPrompts`}
        description={V2_COPY.library.subtitle[lang]}
        canonicalPath="/library"
        noindex
      />
      <main className="container mx-auto px-4 py-6 space-y-6">
        <header>
          <h1 className="text-2xl font-bold sm:text-3xl">
            {V2_COPY.library.title[lang]}
          </h1>
          <p className="text-sm text-muted-foreground">
            {V2_COPY.library.subtitle[lang]}
          </p>
        </header>

        {isLoading ? (
          <Skeleton className="h-20 w-full max-w-md" />
        ) : isError ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
            {V2_COPY.library.loadError[lang]}
            <Button size="sm" variant="outline" onClick={() => refetch()} className="ms-3">
              {V2_COPY.library.retry[lang]}
            </Button>
          </div>
        ) : hasLibrary ? (
          <LifetimeProgress progressFils={0} hasLibrary />
        ) : (
          <LifetimeProgress progressFils={library?.lifetime_progress_fils ?? 0} />
        )}

        <LegacyAccessSummary />


        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap gap-1 h-auto">
            {(["all", ...V2_RESOURCE_TYPES] as const).map((t) => (
              <TabsTrigger key={t} value={t} className="min-h-[40px]">
                {tabLabel(t, lang)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {resourcesLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-2xl" />
            ))}
          </div>
        ) : resourcesError ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
            {V2_COPY.library.loadError[lang]}
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetchResources()}
              className="ms-3"
            >
              {V2_COPY.library.retry[lang]}
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {V2_COPY.library.empty[lang]}{" "}
              <Link to="/explore" className="text-warm-gold hover:underline">
                {V2_COPY.nav.explore[lang]}
              </Link>
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((r) => {
              const title = lang === "ar" && r.title_ar ? r.title_ar : r.title_en;
              const list = filesByResource.get(r.id) ?? [];
              const archived = r.lifecycle === "archived";
              const individuallyOwned = entitledIds.includes(r.id);
              return (
                <article key={r.id} className="rounded-2xl border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link
                        to={`/resources/${r.slug}`}
                        className="font-semibold hover:text-warm-gold"
                      >
                        {title}
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="capitalize">
                          {r.type?.replace("_", " ")}
                        </Badge>
                        {individuallyOwned ? (
                          <Badge variant="secondary">
                            {V2_COPY.library.individualBadge[lang]}
                          </Badge>
                        ) : null}
                        {hasLibrary ? (
                          <Badge className="bg-warm-gold/20 text-warm-gold hover:bg-warm-gold/25">
                            {V2_COPY.library.lifetimeBadge[lang]}
                          </Badge>
                        ) : null}
                        {archived ? <Badge variant="outline">Archived</Badge> : null}
                      </div>
                    </div>
                  </div>
                  {filesLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : list.length > 0 ? (
                    <div className="space-y-1.5">
                      {list.map((f) => {
                        const pending =
                          download.isPending &&
                          download.variables === f.resource_file_id;
                        return (
                          <div
                            key={f.resource_file_id}
                            className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                          >
                            <div className="min-w-0">
                              <div className="truncate">{f.file_name}</div>
                              <div className="text-xs text-muted-foreground">v{f.version}</div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => download.mutate(f.resource_file_id)}
                              disabled={pending}
                              aria-label={`Download ${f.file_name}`}
                            >
                              {pending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" aria-hidden />
                              )}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {V2_COPY.library.noPackage[lang]}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {inactive && inactive.length > 0 ? (
          <section aria-label={V2_COPY.library.inactive[lang]} className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">
                {V2_COPY.library.inactive[lang]}{" "}
                <span className="text-muted-foreground text-sm">({inactive.length})</span>
              </h2>
              <p className="text-xs text-muted-foreground">
                {V2_COPY.library.inactiveDesc[lang]}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {inactive.map((e) => {
                const title =
                  lang === "ar" && e.title_ar ? e.title_ar : e.title_en;
                const status =
                  e.status === "revoked"
                    ? V2_COPY.library.revoked[lang]
                    : V2_COPY.library.expired[lang];
                return (
                  <article
                    key={e.entitlement_id}
                    className="rounded-2xl border border-muted p-4 opacity-80"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          to={`/resources/${e.resource_slug}`}
                          className="font-medium hover:text-warm-gold"
                        >
                          {title}
                        </Link>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <Badge variant="outline" className="capitalize">
                            {e.resource_type?.replace("_", " ")}
                          </Badge>
                          <Badge variant="destructive">{status}</Badge>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
