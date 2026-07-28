import { describe, it, expect } from "bun:test";
import {
  formatShortDate,
  notSpecified,
  ownershipLabel,
  trustBadge,
  updatedIso,
  versionLabel,
} from "@/components/v2/cardMetadata";
import type { ExploreResource } from "@/hooks/v2/useExploreResources";
import { formatKwd } from "@/config/v2Flags";

/** Minimal factory — only fields the helpers touch. */
function make(over: Partial<ExploreResource> = {}): ExploreResource {
  return {
    id: "r1",
    slug: "r1",
    type: "skill",
    title_en: "Skill",
    title_ar: null,
    summary_en: null,
    summary_ar: null,
    hero_image_path: null,
    effort_minutes: null,
    published_at: null,
    updated_at: "2026-01-15T10:00:00Z",
    current_version: null,
    platforms: [],
    product: null,
    trust: null,
    owned: false,
    ownedVia: null,
    ...over,
  } as ExploreResource;
}

describe("cardMetadata — public card contract", () => {
  describe("ownershipLabel precedence", () => {
    it("lifetime beats individual ownership", () => {
      const r = make({
        owned: true,
        ownedVia: "library",
        product: { id: "p", product_type: "individual", price_fils: 5000, is_active: true },
      });
      expect(ownershipLabel(r, "en", formatKwd).kind).toBe("lifetime");
      expect(ownershipLabel(r, "en", formatKwd).text).toMatch(/lifetime/i);
    });

    it("individual ownership beats price", () => {
      const r = make({
        owned: true,
        ownedVia: "resource",
        product: { id: "p", product_type: "individual", price_fils: 5000, is_active: true },
      });
      expect(ownershipLabel(r, "en", formatKwd).kind).toBe("owned");
    });

    it("free product renders Free", () => {
      const r = make({
        product: { id: "p", product_type: "free", price_fils: 0, is_active: true },
      });
      expect(ownershipLabel(r, "en", formatKwd).kind).toBe("free");
    });

    it("priced product renders exact KWD from integer fils", () => {
      const r = make({
        product: { id: "p", product_type: "individual", price_fils: 12500, is_active: true },
      });
      const o = ownershipLabel(r, "en", formatKwd);
      expect(o.kind).toBe("priced");
      expect(o.text).toContain("KD");
      expect(o.text).toMatch(/12\.5/);
    });

    it("missing product renders truthful Not specified", () => {
      const o = ownershipLabel(make(), "en", formatKwd);
      expect(o.kind).toBe("unknown");
      expect(o.text).toBe(notSpecified("en"));
    });

    it("bilingual: lifetime label localizes", () => {
      const r = make({ owned: true, ownedVia: "library" });
      const en = ownershipLabel(r, "en", formatKwd).text;
      const ar = ownershipLabel(r, "ar", formatKwd).text;
      expect(en.length).toBeGreaterThan(0);
      expect(ar.length).toBeGreaterThan(0);
      expect(en === ar).toBe(false);
    });

  });

  describe("trustBadge", () => {
    it("clean scan → verified tone", () => {
      expect(trustBadge(make({ trust: { scan_status: "clean", scanned_at: null } }), "en").tone)
        .toBe("verified");
    });
    it("pending scan → pending tone", () => {
      expect(trustBadge(make({ trust: { scan_status: "pending", scanned_at: null } }), "en").tone)
        .toBe("pending");
    });
    it("no trust data → unknown tone with Not specified label", () => {
      const tb = trustBadge(make(), "en");
      expect(tb.tone).toBe("unknown");
      expect(tb.label).toBe(notSpecified("en"));
    });
  });

  describe("version + date helpers", () => {
    it("versionLabel returns v-prefixed version when present", () => {
      expect(versionLabel(make({ current_version: { id: "v", version: "1.2.0", major_version: 1, updated_at: null } })))
        .toBe("v1.2.0");
    });
    it("versionLabel returns null when absent (caller renders Not specified)", () => {
      expect(versionLabel(make())).toBeNull();
    });
    it("updatedIso prefers version.updated_at over resource.updated_at", () => {
      const r = make({
        current_version: { id: "v", version: "1", major_version: 1, updated_at: "2026-06-01T00:00:00Z" },
      });
      expect(updatedIso(r)).toBe("2026-06-01T00:00:00Z");
    });
    it("formatShortDate localizes and returns null for invalid input", () => {
      expect(formatShortDate("not-a-date", "en")).toBeNull();
      expect(formatShortDate(null, "en")).toBeNull();
      expect(formatShortDate("2026-01-15T10:00:00Z", "en")).toBeTruthy();
    });
  });
});
