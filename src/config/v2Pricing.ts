/**
 * Locked KWD/fils pricing contract for V2. Kept in its own pure module so
 * marketing surfaces (V2PricingPage) AND contract tests can read it without
 * pulling in supabase/localStorage-dependent modules.
 *
 * If any value here changes, update the customer-facing pricing surface and
 * the associated tests in the same commit.
 */

export interface PricingTier {
  key: string;
  en: { name: string; desc: string };
  ar: { name: string; desc: string };
  price: string;
}

export const V2_PRICING_TIERS: readonly PricingTier[] = [
  {
    key: "free",
    en: { name: "Free resources", desc: "Selected starter resources at no cost." },
    ar: { name: "موارد مجانية", desc: "موارد مختارة للبدء بدون تكلفة." },
    price: "0 KD",
  },
  {
    key: "prompt_image_style",
    en: { name: "Prompt or image style", desc: "Single prompt or single image style." },
    ar: { name: "برومبت أو نمط صورة", desc: "برومبت واحد أو نمط صورة واحد." },
    price: "0.900 KD",
  },
  {
    key: "prompt_pack",
    en: { name: "Structured prompt pack", desc: "Curated multi-prompt pack." },
    ar: { name: "حزمة برومبتات مُنظمة", desc: "حزمة برومبتات متعددة منسّقة." },
    price: "1.500 KD",
  },
  {
    key: "skill",
    en: { name: "Skill", desc: "AI skill / assistant configuration." },
    ar: { name: "مهارة", desc: "إعداد مهارة/مساعد ذكاء اصطناعي." },
    price: "1.500 – 3.000 KD",
  },
  {
    key: "automation",
    en: { name: "Automation / workflow", desc: "End-to-end automation or workflow." },
    ar: { name: "أتمتة / سير عمل", desc: "أتمتة أو سير عمل متكامل." },
    price: "2.500 – 5.000 KD",
  },
  {
    key: "bundle",
    en: { name: "Bundle", desc: "Curated bundle of related resources." },
    ar: { name: "حزمة", desc: "حزمة منسّقة من موارد مترابطة." },
    price: "4.500 – 12.000 KD",
  },
] as const;

export const V2_LIFETIME_PRICE_KD = "30.000 KD";
