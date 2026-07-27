import { describe, it, expect } from "bun:test";
import { V2_PRICING_TIERS, V2_LIFETIME_PRICE_KD } from "@/config/v2Pricing";

/**
 * Guardrails around the locked KWD/fils pricing contract advertised on
 * /pricing. If a tier or the lifetime price drifts, this test flips red
 * before the marketing surface can lie to customers.
 */
describe("V2 pricing contract", () => {
  const byKey = Object.fromEntries(V2_PRICING_TIERS.map((t) => [t.key, t.price]));

  it("advertises the locked KWD tiers", () => {
    expect(byKey.free).toBe("0 KD");
    expect(byKey.prompt_image_style).toBe("0.900 KD");
    expect(byKey.prompt_pack).toBe("1.500 KD");
    expect(byKey.skill).toBe("1.500 – 3.000 KD");
    expect(byKey.automation).toBe("2.500 – 5.000 KD");
    expect(byKey.bundle).toBe("4.500 – 12.000 KD");
  });

  it("advertises the 30.000 KD Full Library Lifetime price", () => {
    expect(V2_LIFETIME_PRICE_KD).toBe("30.000 KD");
  });

  it("provides bilingual EN + AR labels for every tier", () => {
    for (const tier of V2_PRICING_TIERS) {
      expect(tier.en.name.length).toBeGreaterThan(0);
      expect(tier.ar.name.length).toBeGreaterThan(0);
    }
  });
});
