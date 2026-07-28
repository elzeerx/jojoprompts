import { Helmet } from "react-helmet-async";
import { isLaunchLocked, isPreviewHost } from "@/config/siteMode";

interface SeoHeadProps {
  title: string;
  description?: string;
  canonicalPath: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  ogType?: "website" | "article" | "product";
  /** Absolute production https URL. Optional — defaults to DEFAULT_OG_IMAGE. */
  ogImage?: string;
}

/**
 * Production origin used for canonical + og:url + JSON-LD `url` fields
 * across V2. We deliberately do NOT point crawlers at the Lovable preview
 * host; a preview URL as canonical would let search engines attribute the
 * production page to a private preview subdomain.
 */
export const PRODUCTION_ORIGIN = "https://jojoprompts.com";
export const PRODUCTION_HOST = "jojoprompts.com";

/**
 * Stable, production-hosted share image. Reuses the existing Jojo wordmark
 * asset copied into a stable `/og/` path so crawlers cache a permanent URL.
 * A 1200x630 branded share card is a later design enhancement — this
 * placeholder is intentionally non-preview and non-lovable.app.
 */
export const DEFAULT_OG_IMAGE = `${PRODUCTION_ORIGIN}/og/jojoprompts-v2.png`;

/**
 * Pure indexability decision — exported for tests. Production origin
 * (jojoprompts.com) can emit `index,follow` only when the launch lock is
 * deliberately disabled AND the caller has not opted out (`noindex`).
 * Every other environment (preview subdomains, dev hosts, SSR/window
 * absence, or launch-locked production) MUST emit `noindex,nofollow`.
 */
export function shouldNoindex(params: {
  optOut?: boolean;
  hostname: string | null | undefined;
  launchLocked: boolean;
}): boolean {
  if (params.optOut) return true;
  if (params.launchLocked) return true;
  const host =
    typeof params.hostname === "string" ? params.hostname.toLowerCase() : "";
  if (host === PRODUCTION_HOST) return false;
  // Preview hosts, dev hosts, unknown hosts, and SSR (no hostname) all
  // fail closed to noindex so crawlers never see a preview as canonical.
  if (isPreviewHost(host)) return true;
  return true;
}

function currentHostname(): string | null {
  if (typeof window === "undefined" || !window.location) return null;
  return window.location.hostname || null;
}

export function SeoHead({
  title,
  description,
  canonicalPath,
  noindex,
  jsonLd,
  ogType = "website",
  ogImage = DEFAULT_OG_IMAGE,
}: SeoHeadProps) {
  const url = canonicalPath.startsWith("http")
    ? canonicalPath
    : `${PRODUCTION_ORIGIN}${canonicalPath}`;
  const ldItems = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];
  const effectiveNoindex = shouldNoindex({
    optOut: noindex,
    hostname: currentHostname(),
    launchLocked: isLaunchLocked(),
  });
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
