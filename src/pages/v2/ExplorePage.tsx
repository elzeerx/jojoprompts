import { lazy, Suspense, useCallback, useState } from "react";
import { useLocation } from "react-router-dom";
import { SeoHead } from "@/components/v2/SeoHead";
import { V2_COPY, type V2ResourceType } from "@/config/v2Flags";
import { useTranslation } from "@/hooks/useTranslation";

type Bilingual = { en: string; ar: string };

interface Props {
  fixedType?: V2ResourceType;
  /** Page H1 — accepts a legacy string or a bilingual pair. */
  title?: string | Bilingual;
  emptyTitle?: Bilingual;
  emptyDesc?: Bilingual;
  seoTitle?: Bilingual;
  seoDescription?: Bilingual;
  canonicalPath?: string;
}

const ExploreCatalogContent = lazy(() => import("./ExploreCatalogContent"));
const ExploreLifetimeStatus = lazy(() =>
  import("./ExploreCatalogContent").then((module) => ({
    default: module.ExploreLifetimeStatus,
  })),
);

function resolveTitle(
  title: Props["title"],
  lang: "en" | "ar",
  fallback: string,
): string {
  if (!title) return fallback;
  if (typeof title === "string") return title;
  return title[lang] ?? title.en ?? fallback;
}

function CatalogFallback() {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-label="Loading resources"
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="h-40 w-full animate-pulse rounded-2xl bg-muted"
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

export default function ExplorePage({
  fixedType,
  title,
  emptyTitle,
  emptyDesc,
  seoTitle,
  seoDescription,
  canonicalPath,
}: Props) {
  const location = useLocation();
  const { language, isRTL } = useTranslation();
  const lang = (language as "en" | "ar") ?? "en";
  const [emptyCatalog, setEmptyCatalog] = useState(false);
  const onEmptyCatalogChange = useCallback((empty: boolean) => {
    setEmptyCatalog(empty);
  }, []);

  const fallbackH1 = V2_COPY.nav.explore[lang];
  const pageTitle = resolveTitle(title, lang, fallbackH1);
  const resolvedTitle = seoTitle
    ? `${seoTitle[lang]} · JojoPrompts`
    : `${pageTitle} · JojoPrompts`;
  const resolvedDesc = seoDescription
    ? seoDescription[lang]
    : V2_COPY.explore.subtitle[lang];

  return (
    <div
      className="min-h-screen bg-background"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <SeoHead
        title={resolvedTitle}
        description={resolvedDesc}
        canonicalPath={canonicalPath ?? location.pathname}
        noindex={emptyCatalog}
      />
      <main
        className="container mx-auto space-y-6 px-4 py-6"
        aria-label={pageTitle}
      >
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">{pageTitle}</h1>
            <p className="text-sm text-muted-foreground">
              {V2_COPY.explore.subtitle[lang]}
            </p>
          </div>
          <Suspense fallback={null}>
            <ExploreLifetimeStatus />
          </Suspense>
        </header>

        <Suspense fallback={<CatalogFallback />}>
          <ExploreCatalogContent
            fixedType={fixedType}
            emptyTitle={emptyTitle}
            emptyDesc={emptyDesc}
            onEmptyCatalogChange={onEmptyCatalogChange}
          />
        </Suspense>
      </main>
    </div>
  );
}
