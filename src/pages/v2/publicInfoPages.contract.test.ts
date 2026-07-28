import { describe, expect, it } from "bun:test";

declare const require: (module: string) => unknown;
const { readFileSync } = require("node:fs") as {
  readFileSync: (path: string, encoding: string) => string;
};
const { resolve } = require("node:path") as {
  resolve: (...paths: string[]) => string;
};

const ROOT = resolve((import.meta as unknown as { dir: string }).dir, "..");
const readPage = (name: string) =>
  readFileSync(resolve(ROOT, `${name}.tsx`), "utf8");

const ABOUT = readPage("AboutPage");
const FAQ = readPage("FAQPage");
const CONTACT = readPage("ContactPage");
const PRIVACY = readPage("PrivacyPolicyPage");
const TERMS = readPage("TermsOfServicePage");
const LEGAL_LAYOUT = readFileSync(resolve(ROOT, "v2/LegalDocumentPage.tsx"), "utf8");

describe("V2 public information pages", () => {
  it("routes every information page through bilingual language state and V2 SEO", () => {
    for (const source of [ABOUT, FAQ, CONTACT, PRIVACY, TERMS]) {
      expect(source.includes("useTranslation")).toBe(true);
      expect(source.includes('language === "ar"')).toBe(true);
    }
    for (const source of [ABOUT, FAQ, CONTACT]) {
      expect(source.includes("<SeoHead")).toBe(true);
    }
    expect(LEGAL_LAYOUT.includes("<SeoHead")).toBe(true);
    expect(ABOUT.includes('canonicalPath="/about"')).toBe(true);
    expect(FAQ.includes('canonicalPath="/faq"')).toBe(true);
    expect(CONTACT.includes('canonicalPath="/contact"')).toBe(true);
    expect(PRIVACY.includes('canonicalPath="/privacy"')).toBe(true);
    expect(TERMS.includes('canonicalPath="/terms"')).toBe(true);
  });

  it("removes the legacy subscription, PayPal, favorites, and creator-upload experience", () => {
    const active = [ABOUT, FAQ, CONTACT, PRIVACY, TERMS].join("\n").toLowerCase();
    for (const stalePhrase of [
      "basic, pro, and enterprise",
      "cancel my subscription",
      "paypal",
      "my subscription",
      "floating add button",
      "add it to your favorites",
      "subscribers can create",
      "available 9 am - 6 pm est",
    ]) {
      expect(active.includes(stalePhrase)).toBe(false);
    }
  });

  it("states the locked one-time ownership and creator scope truthfully", () => {
    expect(FAQ.includes("one-time payments only")).toBe(true);
    expect(FAQ.includes("30.000 KD")).toBe(true);
    expect(FAQ.includes("Creator contributions")).toBe(true);
    expect(ABOUT.includes("Jojo-owned resources only")).toBe(true);
    expect(TERMS.includes("does not offer subscriptions or a creator marketplace")).toBe(true);
    expect(TERMS.includes("Jojo Full Library Lifetime costs 30.000 KD")).toBe(true);
  });

  it("documents current providers and data boundaries", () => {
    for (const provider of ["Supabase", "UPayments", "Resend", "Cloudmersive"]) {
      expect(PRIVACY.includes(provider)).toBe(true);
    }
    expect(PRIVACY.includes("We do not store full card numbers")).toBe(true);
    expect(PRIVACY.includes("V2.0 does not allow customers or creators to upload"))
      .toBe(true);
  });

  it("documents payment verification, refunds, lifetime reversal, and licensing", () => {
    expect(TERMS.includes("return-page message alone is not proof of payment")).toBe(true);
    expect(TERMS.includes("do not promise a general 30-day money-back guarantee"))
      .toBe(true);
    expect(TERMS.includes("may revoke a threshold-derived lifetime entitlement"))
      .toBe(true);
    expect(TERMS.includes("commercial use of outputs")).toBe(true);
    expect(TERMS.includes("may not redistribute, resell, publish, share, or sublicense"))
      .toBe(true);
  });

  it("keeps public controls mobile-safe and semantically labelled", () => {
    expect(FAQ.includes('htmlFor="faq-search"')).toBe(true);
    expect(FAQ.includes("aria-pressed")).toBe(true);
    expect(FAQ.includes("min-h-[44px]")).toBe(true);
    expect(CONTACT.includes('htmlFor="contact-name"')).toBe(true);
    expect(CONTACT.includes('htmlFor="contact-message"')).toBe(true);
    expect(CONTACT.includes("min-h-[44px]")).toBe(true);
    expect(LEGAL_LAYOUT.includes("min-h-[44px]")).toBe(true);
  });
});
