import { useMemo } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { useResourceDetail } from "@/hooks/v2/useResourceDetail";
import { useAuth } from "@/contexts/AuthContext";
import { useLibraryState } from "@/hooks/v2/useLibraryState";
import { useDownloadableFiles } from "@/hooks/v2/useDownloadableFiles";
import { useResourceDownload } from "@/hooks/v2/useResourceDownload";
import { useFreeAcquisition } from "@/hooks/v2/useFreeAcquisition";
import { useNextLoginPath } from "@/hooks/v2/useNextLoginPath";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SeoHead } from "@/components/v2/SeoHead";
import { InstallationSteps } from "@/components/v2/InstallationSteps";
import {
  formatKwd,
  LIFETIME_THRESHOLD_FILS,
  safeHeroImageUrl,
  V2_COPY,
} from "@/config/v2Flags";

import { ShieldCheck, Download, Loader2, ArrowLeft, Timer, Copy, Check } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { AddToCartButton } from "@/components/v2/AddToCartButton";
import { ReportResourceButton } from "@/components/v2/ReportResourceButton";
import { useEntitledResourceContent } from "@/hooks/v2/useEntitledResourceContent";
import { useCopyToClipboard } from "@/hooks/ui/useCopyToClipboard";


type Lang = "en" | "ar";

export default function ResourceDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const nav = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { data, isLoading, isError } = useResourceDetail(slug);
  const { data: library } = useLibraryState();
  const { data: files } = useDownloadableFiles(data?.resource?.id);
  const download = useResourceDownload();
  const acquire = useFreeAcquisition();
  const nextPath = useNextLoginPath();
  const { language, isRTL } = useTranslation();
  const lang: Lang = language === "ar" ? "ar" : "en";

  const owned = useMemo(() => {
    if (!data?.resource) return false;
    if (library?.has_library_access) return true;
    return (library?.entitlements ?? []).some(
      (e) => e.scope === "resource" && e.resource_id === data.resource.id,
    );
  }, [data, library]);

  const legacyPromptId = (data?.resource as { legacy_prompt_id?: string | null } | undefined)
    ?.legacy_prompt_id ?? null;
  const shouldFetchProtected = owned && !!legacyPromptId;
  const {
    data: protectedContent,
    isLoading: protectedLoading,
    isError: protectedError,
  } = useEntitledResourceContent(
    shouldFetchProtected ? data?.resource?.id ?? null : null,
    shouldFetchProtected,
  );
  const { copyToClipboard, hasCopied } = useCopyToClipboard({
    successTitle: language === "ar" ? "تم النسخ" : "Copied",
    successDescription:
      language === "ar" ? "تم نسخ البرومبت." : "Prompt copied to clipboard.",
  });

  if (isLoading) {
    return (
      <div className="min-h-screen">
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
        <SeoHead
          title="Resource not found · JojoPrompts"
          canonicalPath={location.pathname}
          noindex
        />
        <div className="container mx-auto px-4 py-16 text-center">
          <p className="text-lg font-medium">Resource not found.</p>
          <Button variant="outline" className="mt-4" onClick={() => nav("/explore")}>
            {V2_COPY.nav.explore[lang]}
          </Button>
        </div>
      </div>
    );
  }

  const r = data.resource;
  const title = lang === "ar" && r.title_ar ? r.title_ar : r.title_en;
  const summary =
    lang === "ar" && r.summary_ar ? r.summary_ar : r.summary_en;
  const description =
    lang === "ar" && r.description_ar ? r.description_ar : r.description_en;
  const heroUrl = safeHeroImageUrl(r.hero_image_path);

  const product = data.products.find((p) => p.is_active) ?? null;
  const isFree = product?.product_type === "free";

  const handleAcquire = () => {
    if (!user) {
      nav(nextPath);
      return;
    }
    acquire.mutate(r.id);
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": product && !isFree ? "Product" : "CreativeWork",
    name: title,
    description: summary ?? description ?? undefined,
    url: `https://jojoprompts.lovable.app/resources/${r.slug}`,
    ...(product && !isFree
      ? {
          offers: {
            "@type": "Offer",
            price: (product.price_fils / 1000).toFixed(3),
            priceCurrency: "KWD",
            availability: "https://schema.org/InStock",
          },
        }
      : {}),
  };

  const lifetimeText = V2_COPY.detail.lifetimeCallout[lang].replace(
    "{threshold}",
    formatKwd(LIFETIME_THRESHOLD_FILS),
  );

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? "rtl" : "ltr"}>
      <SeoHead
        title={`${title} · JojoPrompts`}
        description={summary ?? undefined}
        canonicalPath={`/resources/${r.slug}`}
        ogType={product && !isFree ? "product" : "article"}
        jsonLd={jsonLd}
      />
      <main className="container mx-auto px-4 py-6 max-w-5xl">
        <button
          onClick={() => nav(-1)}
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {V2_COPY.detail.back[lang]}
        </button>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            <header className="space-y-3">
              {heroUrl ? (
                <img
                  src={heroUrl}
                  alt=""
                  className="w-full rounded-2xl object-cover"
                  loading="lazy"
                />
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Badge className="capitalize">{r.type?.replace("_", " ")}</Badge>
                {data.version && (
                  <Badge variant="outline">v{data.version.version}</Badge>
                )}
                {data.trust?.scan_status === "clean" && (
                  <Badge variant="secondary" className="gap-1">
                    <ShieldCheck className="h-3 w-3" aria-hidden />
                    {V2_COPY.cards.verified[lang]}
                  </Badge>
                )}
                {r.effort_minutes ? (
                  <Badge variant="outline" className="gap-1">
                    <Timer className="h-3 w-3" aria-hidden />
                    {r.effort_minutes} {V2_COPY.cards.minutes[lang]}
                  </Badge>
                ) : null}
              </div>
              <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
              {summary && <p className="text-muted-foreground">{summary}</p>}
            </header>

            {description && (
              <section>
                <h2 className="mb-2 text-lg font-semibold">
                  {V2_COPY.detail.overview[lang]}
                </h2>
                <div className="whitespace-pre-line text-sm leading-relaxed">
                  {description}
                </div>
              </section>
            )}

            {data.platforms.length > 0 && (
              <section>
                <h2 className="mb-2 text-lg font-semibold">
                  {V2_COPY.detail.platforms[lang]}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {data.platforms.map((p) => (
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
                <h2 className="mb-2 text-lg font-semibold">
                  {V2_COPY.detail.installation[lang]}
                </h2>
                <div className="space-y-3">
                  {data.guides.map((g) => (
                    <div key={g.id} className="rounded-lg border p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-sm font-medium capitalize">
                          {g.platform_slug}
                        </div>
                        {g.estimated_minutes ? (
                          <span className="text-xs text-muted-foreground">
                            {g.estimated_minutes} {V2_COPY.cards.minutes[lang]}
                          </span>
                        ) : null}
                      </div>
                      <InstallationSteps
                        stepsEn={g.steps_en}
                        stepsAr={g.steps_ar}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {data.permissions.length > 0 && (
              <section>
                <h2 className="mb-2 text-lg font-semibold">
                  {V2_COPY.detail.permissions[lang]}
                </h2>
                <ul className="space-y-2 text-sm">
                  {data.permissions.map((p) => {
                    const label =
                      lang === "ar" && p.label_ar ? p.label_ar : p.label_en;
                    return (
                      <li
                        key={p.id}
                        className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2"
                      >
                        <Badge variant="outline" className="capitalize">
                          {p.kind}
                        </Badge>
                        <span className="font-medium">{label}</span>
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {p.key}
                        </code>
                        <span
                          className={
                            p.is_required
                              ? "ms-auto text-xs font-medium text-destructive"
                              : "ms-auto text-xs text-muted-foreground"
                          }
                        >
                          {p.is_required
                            ? V2_COPY.detail.required[lang]
                            : V2_COPY.detail.optional[lang]}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {data.license && (
              <section>
                <h2 className="mb-2 text-lg font-semibold">
                  {V2_COPY.detail.license[lang]}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {data.license.license_key}
                </p>
                {(lang === "ar" ? data.license.terms_ar : data.license.terms_en) ? (
                  <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">
                    {lang === "ar" ? data.license.terms_ar : data.license.terms_en}
                  </p>
                ) : null}
              </section>
            )}

            {shouldFetchProtected && (
              <section
                data-testid="entitled-prompt-section"
                className="rounded-2xl border border-warm-gold/30 bg-warm-gold/5 p-4"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">
                    {lang === "ar" ? "برومبتك" : "Your prompt"}
                  </h2>
                  {protectedContent?.ok && (
                    (lang === "ar" ? protectedContent.prompt_text_ar : protectedContent.prompt_text) ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-[44px]"
                        aria-label={lang === "ar" ? "نسخ البرومبت" : "Copy prompt"}
                        onClick={() =>
                          copyToClipboard(
                            (lang === "ar"
                              ? protectedContent.prompt_text_ar
                              : protectedContent.prompt_text) ?? "",
                          )
                        }
                      >
                        {hasCopied ? (
                          <Check className="me-1 h-4 w-4" aria-hidden />
                        ) : (
                          <Copy className="me-1 h-4 w-4" aria-hidden />
                        )}
                        {hasCopied
                          ? lang === "ar" ? "تم النسخ" : "Copied"
                          : lang === "ar" ? "نسخ" : "Copy"}
                      </Button>
                    ) : null
                  )}
                </div>
                {protectedLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    {lang === "ar" ? "جارٍ التحميل…" : "Loading…"}
                  </div>
                ) : protectedError ? (
                  <p className="text-sm text-destructive">
                    {lang === "ar"
                      ? "تعذّر تحميل البرومبت. حاول مرة أخرى."
                      : "Couldn't load the prompt. Please try again."}
                  </p>
                ) : protectedContent && !protectedContent.ok ? (
                  <p className="text-sm text-muted-foreground">
                    {lang === "ar"
                      ? "المحتوى غير متاح."
                      : "Content unavailable."}
                  </p>
                ) : protectedContent?.ok ? (
                  (() => {
                    const text =
                      (lang === "ar"
                        ? protectedContent.prompt_text_ar
                        : protectedContent.prompt_text) ??
                      protectedContent.prompt_text ??
                      protectedContent.prompt_text_ar ??
                      null;
                    return text ? (
                      <pre className="whitespace-pre-wrap break-words rounded-lg bg-background p-3 text-sm leading-relaxed">
                        {text}
                      </pre>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {lang === "ar" ? "لا يوجد محتوى نصي." : "No text content."}
                      </p>
                    );
                  })()
                ) : null}
              </section>
            )}

            {owned && files && files.length > 0 && (
              <section>
                <h2 className="mb-2 text-lg font-semibold">
                  {V2_COPY.detail.downloads[lang]}
                </h2>
                <div className="space-y-2">
                  {files.map((f) => {
                    const pending =
                      download.isPending && download.variables === f.resource_file_id;
                    return (
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
                          disabled={pending}
                          className="min-h-[44px]"
                        >
                          {pending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Download className="h-4 w-4 me-1" aria-hidden />
                              {V2_COPY.detail.downloads[lang]}
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border p-4 space-y-3">
              <div className="text-sm font-medium">
                {owned ? (
                  <span className="text-emerald-600">{V2_COPY.cards.owned[lang]}</span>
                ) : isFree ? (
                  <span className="text-warm-gold text-lg font-bold">
                    {V2_COPY.cards.free[lang]}
                  </span>
                ) : product ? (
                  <span className="text-lg font-bold">
                    {formatKwd(product.price_fils)} KD
                  </span>
                ) : null}
              </div>
              {owned ? (
                <Button className="w-full min-h-[44px]" variant="outline" asChild>
                  <Link to="/library">{V2_COPY.detail.openInLibrary[lang]}</Link>
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
                    V2_COPY.cards.addToLibrary[lang]
                  )}
                </Button>
              ) : product ? (
                <AddToCartButton
                  productId={product.id}
                  productType={product.product_type as "individual" | "bundle" | "lifetime" | "free"}
                  titleEn={r.title_en}
                  titleAr={r.title_ar}
                  resourceType={r.type ?? null}
                  size="default"
                  fullWidth
                />
              ) : (
                <Button
                  className="w-full min-h-[44px]"
                  variant="outline"
                  disabled
                  aria-label={lang === "ar" ? "غير متاح" : "Unavailable"}
                >
                  {lang === "ar" ? "غير متاح" : "Unavailable"}
                </Button>
              )}


              <div className="rounded-lg bg-warm-gold/10 p-3 text-xs">
                <div className="font-semibold text-warm-gold">
                  {V2_COPY.detail.lifetimeTitle[lang]}
                </div>
                <div className="mt-1 text-muted-foreground">{lifetimeText}</div>
              </div>
            </div>

            <div className="flex justify-center">
              <ReportResourceButton resourceId={r.id} lang={lang} />
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
