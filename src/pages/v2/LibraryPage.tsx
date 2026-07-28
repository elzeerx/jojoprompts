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
import { Download, Loader2, Receipt, Search } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { V2_COPY, V2_RESOURCE_TYPES, type V2ResourceType } from "@/config/v2Flags";
import { Input } from "@/components/ui/input";
import { withoutAcquisitionInstruction } from "@/lib/v2/resourceCopy";

type Lang = "en" | "ar";
const PAGE_SIZE = 20;

interface LibraryResourceRow {
  id: string;
  slug: string;
  type: V2ResourceType;
  title_en: string;
  title_ar: string | null;
  summary_en: string | null;
  summary_ar: string | null;
  update_info_en: string | null;
  update_info_ar: string | null;
  updated_at: string;
  lifecycle: "draft" | "review" | "published" | "archived";
  current_version:
    | { id: string; version: string; published_at: string | null }
    | Array<{ id: string; version: string; published_at: string | null }>
    | null;
  installation_guides: Array<{ id: string }>;
  licenses:
    | { id: string; license_key: string }
    | Array<{ id: string; license_key: string }>
    | null;
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

function resourceTypeLabel(type: V2ResourceType, lang: Lang): string {
  return tabLabel(type, lang);
}

function firstRelated<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function formatDate(value: string | null | undefined, lang: Lang): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-KW" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsed);
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
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

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
        .select(
          "id, slug, type, title_en, title_ar, summary_en, summary_ar, update_info_en, update_info_ar, updated_at, lifecycle, current_version:current_version_id(id,version,published_at), installation_guides(id), licenses(id,license_key)",
        )
        .in("lifecycle", ["published", "archived"]);
      if (!hasLibrary) query = query.in("id", entitledIds);
      const { data, error } = await query.order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LibraryResourceRow[];
    },
  });

  const filesByResource = useMemo(() => {
    const map = new Map<string, DownloadableFile[]>();
    (files ?? []).forEach((f) => {
      const list = map.get(f.resource_id) ?? [];
      list.push(f);
      map.set(f.resource_id, list);
    });
    return map;
  }, [files]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [tab, search]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase(lang === "ar" ? "ar" : "en");
    return (resources ?? []).filter((r) => {
      if (tab !== "all" && r.type !== tab) return false;
      if (!needle) return true;
      return [
        r.title_en,
        r.title_ar,
        r.summary_en,
        r.summary_ar,
        r.type.replace("_", " "),
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLocaleLowerCase(lang === "ar" ? "ar" : "en").includes(needle),
        );
    });
  }, [lang, resources, search, tab]);
  const visibleResources = filtered.slice(0, visibleCount);

  if (!loading && !user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? "rtl" : "ltr"}>
      <SeoHead
        title={`${V2_COPY.library.title[lang]} · JojoPrompts`}
        description={V2_COPY.library.subtitle[lang]}
        canonicalPath="/library"
        noindex
      />
      <main className="container mx-auto px-4 py-6 space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">
              {V2_COPY.library.title[lang]}
            </h1>
            <p className="text-sm text-muted-foreground">
              {V2_COPY.library.subtitle[lang]}
            </p>
          </div>
          <Button asChild variant="outline" className="min-h-[44px] w-full sm:w-auto">
            <Link to="/orders">
              <Receipt className="me-2 h-4 w-4" aria-hidden />
              {V2_COPY.library.orders[lang]}
            </Link>
          </Button>
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
              <TabsTrigger key={t} value={t} className="min-w-[44px]">
                {tabLabel(t, lang)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <label htmlFor="library-search" className="sr-only">
              {V2_COPY.library.search[lang]}
            </label>
            <Search
              className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="library-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={V2_COPY.library.search[lang]}
              className="min-h-[44px] ps-9"
              type="search"
            />
          </div>
          {!resourcesLoading && !resourcesError ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {filtered.length} {V2_COPY.library.results[lang]}
            </p>
          ) : null}
        </div>

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
          <>
          <div className="grid gap-4 md:grid-cols-2">
            {visibleResources.map((r) => {
              const title = lang === "ar" && r.title_ar ? r.title_ar : r.title_en;
              const summary = withoutAcquisitionInstruction(
                lang === "ar" && r.summary_ar ? r.summary_ar : r.summary_en,
              );
              const updateInfo =
                lang === "ar" && r.update_info_ar
                  ? r.update_info_ar
                  : r.update_info_en;
              const list = filesByResource.get(r.id) ?? [];
              const archived = r.lifecycle === "archived";
              const individuallyOwned = entitledIds.includes(r.id);
              const version = firstRelated(r.current_version);
              const license = firstRelated(r.licenses);
              const updated = formatDate(
                version?.published_at ?? r.updated_at,
                lang,
              );
              const expectsPackage =
                r.type === "skill" || r.type === "automation" || r.type === "bundle";
              return (
                <article key={r.id} className="rounded-2xl border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link
                        to={`/resources/${r.slug}`}
                        className="inline-flex min-h-[44px] items-center font-semibold hover:text-warm-gold md:min-h-0"
                      >
                        {title}
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge variant="outline">
                          {resourceTypeLabel(r.type, lang)}
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
                        {archived ? (
                          <Badge variant="outline">
                            {lang === "ar" ? "مؤرشف" : "Archived"}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  {summary ? (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {summary}
                    </p>
                  ) : null}
                  <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                    <div className="flex items-center justify-between gap-2 sm:block">
                      <dt className="text-muted-foreground">
                        {V2_COPY.library.version[lang]}
                      </dt>
                      <dd className="font-medium">{version?.version ?? "—"}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-2 sm:block">
                      <dt className="text-muted-foreground">
                        {V2_COPY.library.updated[lang]}
                      </dt>
                      <dd className="font-medium">{updated ?? "—"}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-2 sm:block">
                      <dt className="text-muted-foreground">
                        {V2_COPY.library.standardLicense[lang]}
                      </dt>
                      <dd className="font-medium">
                        {license?.license_key === "jojo-standard-v1"
                          ? "v1"
                          : license?.license_key ?? "v1"}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2 sm:block">
                      <dt className="text-muted-foreground">
                        {V2_COPY.library.installGuide[lang]}
                      </dt>
                      <dd className="font-medium">
                        {r.installation_guides?.length > 0
                          ? lang === "ar" ? "متاح" : "Available"
                          : lang === "ar" ? "داخل صفحة المورد" : "On resource page"}
                      </dd>
                    </div>
                  </dl>
                  {updateInfo ? (
                    <p className="line-clamp-2 rounded-lg bg-muted/40 p-2 text-xs text-muted-foreground">
                      {updateInfo}
                    </p>
                  ) : null}
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
                  ) : expectsPackage ? (
                    <p className="text-xs text-muted-foreground">
                      {V2_COPY.library.noPackage[lang]}
                    </p>
                  ) : null}
                  <Button asChild variant="outline" className="min-h-[44px] w-full">
                    <Link to={`/resources/${r.slug}`}>
                      {V2_COPY.library.openResource[lang]}
                    </Link>
                  </Button>
                </article>
              );
            })}
          </div>
          {visibleCount < filtered.length ? (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px] min-w-36"
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
              >
                {V2_COPY.library.loadMore[lang]}
              </Button>
            </div>
          ) : null}
          </>
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
                          className="inline-flex min-h-[44px] items-center font-medium hover:text-warm-gold md:min-h-0"
                        >
                          {title}
                        </Link>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <Badge variant="outline">
                            {resourceTypeLabel(e.resource_type as V2ResourceType, lang)}
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
