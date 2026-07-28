/**
 * Shared helpers for the Explore/homepage resource card contract.
 *
 * These are pure and truthful — never invent metadata. Missing values map
 * to the bilingual "Not specified" fallback so cards degrade gracefully
 * on legacy rows without lying about platform/version/trust state.
 */
import type { ExploreResource } from "@/hooks/v2/useExploreResources";
import { V2_COPY } from "@/config/v2Flags";

export type Lang = "en" | "ar";

export function notSpecified(lang: Lang): string {
  return V2_COPY.cards.notSpecified[lang];
}

export function formatShortDate(iso: string | null | undefined, lang: Lang): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(lang === "ar" ? "ar" : "en", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export interface TrustBadge {
  /** UI variant hint. */
  tone: "verified" | "pending" | "unknown";
  label: string;
}

export function trustBadge(r: ExploreResource, lang: Lang): TrustBadge {
  const status = r.trust?.scan_status ?? null;
  if (status === "clean") {
    return { tone: "verified", label: V2_COPY.cards.verified[lang] };
  }
  if (status === "pending" || status === "queued" || status === "scanning") {
    return { tone: "pending", label: V2_COPY.cards.awaitingScan[lang] };
  }
  return { tone: "unknown", label: notSpecified(lang) };
}

/**
 * Ownership label precedence, matching the visible price/state chip:
 *   1) Library lifetime access  → "Included with Lifetime"
 *   2) Individually owned       → "Owned"
 *   3) Free product             → "Free"
 *   4) Priced product           → exact KWD amount (integer fils formatted)
 *   5) No product row           → "Not specified" (truthful neutral state)
 */
export function ownershipLabel(
  r: ExploreResource,
  lang: Lang,
  formatKwd: (fils: number) => string,
): { text: string; kind: "lifetime" | "owned" | "free" | "priced" | "unknown" } {
  if (r.ownedVia === "library") {
    return { text: V2_COPY.cards.includedLifetime[lang], kind: "lifetime" };
  }
  if (r.owned) {
    return { text: V2_COPY.cards.owned[lang], kind: "owned" };
  }
  if (r.product?.product_type === "free") {
    return { text: V2_COPY.cards.free[lang], kind: "free" };
  }
  if (r.product) {
    return { text: `${formatKwd(r.product.price_fils)} KD`, kind: "priced" };
  }
  return { text: notSpecified(lang), kind: "unknown" };
}

export function versionLabel(r: ExploreResource): string | null {
  return r.current_version ? `v${r.current_version.version}` : null;
}

export function updatedIso(r: ExploreResource): string | null {
  return r.current_version?.updated_at ?? r.updated_at ?? null;
}
