import { Helmet } from "react-helmet-async";
import { isLaunchLocked } from "@/config/siteMode";

interface SeoHeadProps {
  title: string;
  description?: string;
  canonicalPath: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  ogType?: "website" | "article" | "product";
  /** Absolute production https URL. Optional — omit to skip og:image. */
  ogImage?: string;
}

/**
 * Production origin used for canonical + og:url + JSON-LD `url` fields
 * across V2. We deliberately do NOT point crawlers at the Lovable preview
 * host; a preview URL as canonical would let search engines attribute the
 * production page to a private preview subdomain.
 */
export const PRODUCTION_ORIGIN = "https://jojoprompts.com";

export function SeoHead({
  title,
  description,
  canonicalPath,
  noindex,
  jsonLd,
  ogType = "website",
  ogImage,
}: SeoHeadProps) {
  const url = canonicalPath.startsWith("http")
    ? canonicalPath
    : `${PRODUCTION_ORIGIN}${canonicalPath}`;
  const ldItems = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];
  // Environment/maintenance gate — while Coming Soon is in effect every
  // route must remain noindex regardless of per-page opt-out. Removing
  // launch lock re-enables per-route index,follow.
  const effectiveNoindex = noindex || isLaunchLocked();
  return (
    <Helmet>
      <title>{title}</title>
      {description ? <meta name="description" content={description} /> : null}
      <link rel="canonical" href={url} />
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={title} />
      {description ? (
        <meta property="og:description" content={description} />
      ) : null}
      <meta property="og:url" content={url} />
      {ogImage ? <meta property="og:image" content={ogImage} /> : null}
      <meta name="twitter:card" content={ogImage ? "summary_large_image" : "summary"} />
      <meta name="twitter:title" content={title} />
      {description ? (
        <meta name="twitter:description" content={description} />
      ) : null}
      <meta name="twitter:url" content={url} />
      {ogImage ? <meta name="twitter:image" content={ogImage} /> : null}
      {effectiveNoindex ? (
        <meta name="robots" content="noindex,nofollow" />
      ) : (
        <meta name="robots" content="index,follow" />
      )}
      {ldItems.map((item, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(item)}
        </script>
      ))}
    </Helmet>
  );
}
