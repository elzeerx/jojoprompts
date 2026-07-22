import { useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useResourceDetail } from "@/hooks/v2/useResourceDetail";
import { useAuth } from "@/contexts/AuthContext";
import { useLibraryState } from "@/hooks/v2/useLibraryState";
import { useDownloadableFiles } from "@/hooks/v2/useDownloadableFiles";
import { useResourceDownload } from "@/hooks/v2/useResourceDownload";
import { useFreeAcquisition } from "@/hooks/v2/useFreeAcquisition";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { V2SubNav } from "@/components/v2/V2SubNav";
import { V2_COMMERCE_ENABLED, formatKwd, LIFETIME_THRESHOLD_FILS } from "@/config/v2Flags";
import { ShieldCheck, Download, Loader2, ArrowLeft } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

export default function ResourceDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const nav = useNavigate();
  const { user } = useAuth();
  const { data, isLoading, isError } = useResourceDetail(slug);
  const { data: library } = useLibraryState();
  const { data: files } = useDownloadableFiles(data?.resource?.id);
  const download = useResourceDownload();
  const acquire = useFreeAcquisition();
  const { language } = useTranslation();

  useEffect(() => {
    if (data?.resource) {
      const t = language === "ar" && data.resource.title_ar
        ? data.resource.title_ar
        : data.resource.title_en;
      document.title = `${t} · JojoPrompts`;
    }
  }, [data, language]);

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <V2SubNav authed={!!user} />
        <div className="container mx-auto px-4 py-8 space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }
  if (isError || !data?.resource) {
    return (
      <div className="min-h-screen">
        <V2SubNav authed={!!user} />
        <div className="container mx-auto px-4 py-16 text-center">
          <p className="text-lg font-medium">Resource not found.</p>
          <Button variant="outline" className="mt-4" onClick={() => nav("/explore")}>
            Back to Explore
          </Button>
        </div>
      </div>
    );
  }

  const r = data.resource;
  const title = language === "ar" && r.title_ar ? r.title_ar : r.title_en;
  const summary =
    language === "ar" && r.summary_ar ? r.summary_ar : r.summary_en;
  const description =
    language === "ar" && r.description_ar
      ? r.description_ar
      : r.description_en;

  const product = data.products.find((p: any) => p.is_active) ?? null;
  const isFree = product?.product_type === "free";
  const ownedResource =
    !!library?.has_library_access ||
    (library?.entitlements ?? []).some(
      (e) => e.scope === "resource" && e.resource_id === r.id,
    );

  const handleAcquire = () => {
    if (!user) {
      nav(`/login?redirect=${encodeURIComponent(`/resources/${slug}`)}`);
      return;
    }
    acquire.mutate(r.id);
  };

  return (
    <div className="min-h-screen bg-background">
      <V2SubNav authed={!!user} />
      <main className="container mx-auto px-4 py-6 max-w-5xl">
        <button
          onClick={() => nav(-1)}
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            <header className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge className="capitalize">{r.type?.replace("_", " ")}</Badge>
                {data.version && (
                  <Badge variant="outline">v{data.version.version}</Badge>
                )}
                {data.trust?.scan_status === "clean" && (
                  <Badge variant="secondary" className="gap-1">
                    <ShieldCheck className="h-3 w-3" /> Verified & Scanned
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
              {summary && <p className="text-muted-foreground">{summary}</p>}
            </header>

            {description && (
              <section>
                <h2 className="mb-2 text-lg font-semibold">Overview</h2>
                <div className="whitespace-pre-line text-sm leading-relaxed">
                  {description}
                </div>
              </section>
            )}

            {data.platforms.length > 0 && (
              <section>
                <h2 className="mb-2 text-lg font-semibold">Platforms & Compatibility</h2>
                <div className="flex flex-wrap gap-2">
                  {data.platforms.map((p: any) => (
                    <Badge key={p.id} variant="outline" className="capitalize">
                      {p.platform_slug}
                      {p.min_version ? ` ≥ ${p.min_version}` : ""}
                    </Badge>
                  ))}
                </div>
              </section>
            )}

            {data.guides.length > 0 && (
              <section>
                <h2 className="mb-2 text-lg font-semibold">Installation</h2>
                <div className="space-y-3">
                  {data.guides.map((g: any) => (
                    <div key={g.id} className="rounded-lg border p-4">
                      <div className="mb-1 text-sm font-medium capitalize">
                        {g.platform_slug}
                      </div>
                      <div className="whitespace-pre-line text-sm text-muted-foreground">
                        {language === "ar" && g.body_ar ? g.body_ar : g.body_en}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {data.permissions.length > 0 && (
              <section>
                <h2 className="mb-2 text-lg font-semibold">Permissions & Dependencies</h2>
                <ul className="list-disc ps-5 text-sm text-muted-foreground space-y-1">
                  {data.permissions.map((p: any) => (
                    <li key={p.id}>
                      <span className="font-medium capitalize text-foreground">
                        {p.kind}
                      </span>
                      {p.name ? `: ${p.name}` : ""}
                      {p.description ? ` — ${p.description}` : ""}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {data.license && (
              <section>
                <h2 className="mb-2 text-lg font-semibold">License</h2>
                <p className="text-sm text-muted-foreground">
                  {data.license.license_key}
                </p>
                {(language === "ar"
                  ? data.license.terms_ar
                  : data.license.terms_en) && (
                  <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">
                    {language === "ar"
                      ? data.license.terms_ar
                      : data.license.terms_en}
                  </p>
                )}
              </section>
            )}

            {ownedResource && files && files.length > 0 && (
              <section>
                <h2 className="mb-2 text-lg font-semibold">Downloads</h2>
                <div className="space-y-2">
                  {files.map((f) => (
                    <div
                      key={f.resource_file_id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{f.file_name}</div>
                        <div className="text-xs text-muted-foreground">
                          v{f.version}
                          {f.size_bytes
                            ? ` · ${(f.size_bytes / 1024).toFixed(1)} KB`
                            : ""}
                          {f.checksum ? ` · ${f.checksum.slice(0, 10)}…` : ""}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => download.mutate(f.resource_file_id)}
                        disabled={download.isPending}
                        className="min-h-[44px]"
                      >
                        {download.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Download className="h-4 w-4 me-1" /> Download
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border p-4 space-y-3">
              <div className="text-sm font-medium">
                {ownedResource ? (
                  <span className="text-emerald-600">You own this</span>
                ) : isFree ? (
                  <span className="text-warm-gold text-lg font-bold">Free</span>
                ) : product ? (
                  <span className="text-lg font-bold">
                    {formatKwd(product.price_fils)} KD
                  </span>
                ) : (
                  <span className="text-muted-foreground">Not for sale</span>
                )}
              </div>
              {ownedResource ? (
                <Button className="w-full" variant="outline" asChild>
                  <Link to="/library">Open in Library</Link>
                </Button>
              ) : isFree ? (
                <Button
                  className="w-full min-h-[44px]"
                  onClick={handleAcquire}
                  disabled={acquire.isPending}
                >
                  {acquire.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Add to library"
                  )}
                </Button>
              ) : product && V2_COMMERCE_ENABLED ? (
                <Button className="w-full min-h-[44px]" disabled>
                  Add to cart
                </Button>
              ) : product ? (
                <Button className="w-full min-h-[44px]" variant="outline" disabled>
                  Checkout coming next
                </Button>
              ) : null}
              <div className="rounded-lg bg-warm-gold/10 p-3 text-xs">
                <div className="font-semibold text-warm-gold">
                  Lifetime access
                </div>
                <div className="mt-1 text-muted-foreground">
                  Spend {formatKwd(LIFETIME_THRESHOLD_FILS)} KD across resources
                  to unlock every current and future Jojo resource.
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
