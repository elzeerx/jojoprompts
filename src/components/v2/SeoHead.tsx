import { Helmet } from "react-helmet-async";

interface SeoHeadProps {
  title: string;
  description?: string;
  canonicalPath: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  ogType?: "website" | "article" | "product";
}

const ORIGIN = "https://jojoprompts.lovable.app";

export function SeoHead({
  title,
  description,
  canonicalPath,
  noindex,
  jsonLd,
  ogType = "website",
}: SeoHeadProps) {
  const url = canonicalPath.startsWith("http")
    ? canonicalPath
    : `${ORIGIN}${canonicalPath}`;
  const ldItems = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];
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
      {noindex ? <meta name="robots" content="noindex,nofollow" /> : null}
      {ldItems.map((item, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(item)}
        </script>
      ))}
    </Helmet>
  );
}
