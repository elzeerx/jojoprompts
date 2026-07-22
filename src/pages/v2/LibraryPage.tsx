import { useEffect, useMemo, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLibraryState } from "@/hooks/v2/useLibraryState";
import { useDownloadableFiles } from "@/hooks/v2/useDownloadableFiles";
import { useResourceDownload } from "@/hooks/v2/useResourceDownload";
import { LifetimeProgress } from "@/components/v2/LifetimeProgress";
import { V2SubNav } from "@/components/v2/V2SubNav";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

const TABS = [
  { id: "all", label: "All" },
  { id: "skill", label: "Skills" },
  { id: "automation", label: "Automations" },
  { id: "prompt", label: "Prompts" },
  { id: "image_style", label: "Image Styles" },
  { id: "bundle", label: "Bundles" },
];

export default function LibraryPage() {
  const { user, loading } = useAuth();
  const { data: library, isLoading } = useLibraryState();
  const { data: files } = useDownloadableFiles();
  const download = useResourceDownload();
  const { language } = useTranslation();
  const [tab, setTab] = useState<string>("all");

  useEffect(() => {
    document.title = "My Library · JojoPrompts";
  }, []);

  // Collect entitled resource IDs (resource-scope + library flag handled separately)
  const resourceIds = useMemo(() => {
    const ids = new Set<string>();
    (library?.entitlements ?? []).forEach((e) => {
      if (e.scope === "resource" && e.resource_id) ids.add(e.resource_id);
    });
    return Array.from(ids);
  }, [library]);

  const { data: resources } = useQuery({
    queryKey: ["v2", "library-resources", resourceIds.sort().join(",")],
    enabled: resourceIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select("id, slug, type, title_en, title_ar, lifecycle")
        .in("id", resourceIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!loading && !user)
    return <Navigate to={`/login?redirect=${encodeURIComponent("/library")}`} replace />;

  const filesByResource = new Map<string, typeof files>();
  (files ?? []).forEach((f) => {
    const list = filesByResource.get(f.resource_id) ?? [];
    list.push(f);
    filesByResource.set(f.resource_id, list as any);
  });

  const filtered = (resources ?? []).filter(
    (r) => tab === "all" || r.type === tab,
  );

  return (
    <div className="min-h-screen bg-background">
      <V2SubNav authed={!!user} />
      <main className="container mx-auto px-4 py-6 space-y-6">
        <header>
          <h1 className="text-2xl font-bold sm:text-3xl">My Library</h1>
          <p className="text-sm text-muted-foreground">
            Your entitled resources, downloads, and lifetime progress.
          </p>
        </header>

        {isLoading ? (
          <Skeleton className="h-20 w-full max-w-md" />
        ) : library?.has_library_access ? (
          <LifetimeProgress progressFils={0} hasLibrary />
        ) : (
          <LifetimeProgress progressFils={library?.lifetime_progress_fils ?? 0} />
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap gap-1 h-auto">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="min-h-[40px]">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nothing here yet. Browse the{" "}
              <Link to="/explore" className="text-warm-gold hover:underline">
                catalog
              </Link>{" "}
              to add free or paid resources.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((r: any) => {
              const title =
                language === "ar" && r.title_ar ? r.title_ar : r.title_en;
              const list = filesByResource.get(r.id) ?? [];
              const archived = r.lifecycle === "archived";
              return (
                <article
                  key={r.id}
                  className="rounded-2xl border p-4 space-y-3"
                >
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
                        {archived && (
                          <Badge variant="secondary">Archived</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  {list.length > 0 ? (
                    <div className="space-y-1.5">
                      {(list as any[]).map((f) => (
                        <div
                          key={f.resource_file_id}
                          className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                        >
                          <div className="min-w-0">
                            <div className="truncate">{f.file_name}</div>
                            <div className="text-xs text-muted-foreground">
                              v{f.version}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => download.mutate(f.resource_file_id)}
                            disabled={download.isPending}
                          >
                            {download.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No downloadable package for your entitled version yet.
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
