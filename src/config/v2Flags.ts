/**
 * V2 (JojoPrompts 2.0) foundation flags, enums, routes, copy and utilities.
 * Kept small so it can be imported from anywhere without pulling extra deps.
 */

export const V2_COMMERCE_ENABLED = false;

export const V2_RESOURCE_TYPES = [
  "skill",
  "automation",
  "prompt",
  "prompt_pack",
  "image_style",
  "bundle",
] as const;
export type V2ResourceType = (typeof V2_RESOURCE_TYPES)[number];

/** Route each resource type routes to on the V2 catalog. */
export const V2_TYPE_ROUTE: Record<V2ResourceType, string> = {
  skill: "/skills",
  automation: "/automations",
  prompt: "/prompts",
  prompt_pack: "/prompts",
  image_style: "/image-styles",
  bundle: "/bundles",
};

/**
 * Cutover map documented in one place so the future switch to
 * make /prompts the V2 prompts route (and move legacy to /legacy/prompts)
 * is a single-file change. Do NOT wire this into the router today.
 */
export const V2_CUTOVER_ROUTES = {
  /** Where the V2 Prompts catalog lives today (compatibility). */
  currentV2Prompts: "/prompts",
  /** Post-cutover public path for V2 Prompts. */
  futureV2Prompts: "/prompts",
  /** Post-cutover public path for the legacy prompts app. */
  futureLegacyPrompts: "/legacy/prompts",
} as const;

export const V2_PLATFORMS = [
  "claude",
  "chatgpt",
  "codex",
  "gemini",
  "hermes",
  "kimi",
  "generic",
] as const;
export type V2Platform = (typeof V2_PLATFORMS)[number];

export const LIFETIME_THRESHOLD_FILS = 30_000;

export function formatKwd(fils: number | null | undefined): string {
  const v = Math.max(0, Math.round(Number(fils ?? 0)));
  return (v / 1000).toFixed(3);
}

/** Effort filter buckets — surfaced in URL as ?effort=quick|standard|advanced */
export const EFFORT_BUCKETS = ["quick", "standard", "advanced"] as const;
export type EffortBucket = (typeof EFFORT_BUCKETS)[number];

export function effortBucketFor(minutes: number | null | undefined): EffortBucket | null {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return null;
  if (minutes <= 15) return "quick";
  if (minutes <= 45) return "standard";
  return "advanced";
}

/**
 * Only render a hero image when the stored value is a real absolute URL.
 * Private storage paths must go through the resource-download flow, not
 * bare public URL construction.
 */
export function safeHeroImageUrl(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

/* -------------------------------------------------------------------------- */
/* Centralized bilingual copy for V2 surfaces.                                */
/* -------------------------------------------------------------------------- */

type Lang = "en" | "ar";

interface CopyEntry {
  en: string;
  ar: string;
}

export const V2_COPY = {
  nav: {
    explore: { en: "Explore", ar: "استكشف" },
    skills: { en: "Skills", ar: "مهارات" },
    automations: { en: "Automations", ar: "أتمتة" },
    prompts: { en: "Prompts", ar: "برومبتات" },
    promptPacks: { en: "Prompt Packs", ar: "حزم البرومبتات" },
    imageStyles: { en: "Image Styles", ar: "أنماط الصور" },
    bundles: { en: "Bundles", ar: "حزم" },
    library: { en: "My Library", ar: "مكتبتي" },
    howItWorks: { en: "How it works", ar: "كيف يعمل" },
    pricing: { en: "Pricing", ar: "الأسعار" },
    account: { en: "Account", ar: "الحساب" },
    signIn: { en: "Sign in", ar: "تسجيل الدخول" },
  },
  filters: {
    searchPlaceholder: {
      en: "Search prompts, skills, automations, styles, bundles…",
      ar: "ابحث في البرومبتات، المهارات، الأتمتة، الأنماط، الحزم…",
    },
    filters: { en: "Filters", ar: "الفلاتر" },
    apply: { en: "Apply", ar: "تطبيق" },
    reset: { en: "Reset", ar: "إعادة" },
    price: { en: "Price", ar: "السعر" },
    priceAll: { en: "All prices", ar: "كل الأسعار" },
    priceFree: { en: "Free only", ar: "المجاني فقط" },
    pricePaid: { en: "Paid only", ar: "المدفوع فقط" },
    sort: { en: "Sort", ar: "ترتيب" },
    sortNewest: { en: "Newest", ar: "الأحدث" },
    sortUpdated: { en: "Recently updated", ar: "الأحدث تحديثاً" },
    sortPriceAsc: { en: "Price: low to high", ar: "السعر: من الأقل" },
    sortPriceDesc: { en: "Price: high to low", ar: "السعر: من الأعلى" },
    effort: { en: "Effort", ar: "الجهد" },
    effortAll: { en: "Any effort", ar: "أي جهد" },
    effortQuick: { en: "Quick (≤15 min)", ar: "سريع (≤ ١٥ د)" },
    effortStandard: { en: "Standard (16–45)", ar: "قياسي (١٦–٤٥)" },
    effortAdvanced: { en: "Advanced (>45)", ar: "متقدم (> ٤٥)" },
    platform: { en: "Platform", ar: "المنصة" },
  },
  cards: {
    free: { en: "Free", ar: "مجاني" },
    owned: { en: "Owned", ar: "مملوك" },
    open: { en: "Open", ar: "افتح" },
    addToLibrary: { en: "Add to library", ar: "أضف إلى المكتبة" },
    viewDetails: { en: "View details", ar: "عرض التفاصيل" },
    checkoutSoon: { en: "Checkout coming", ar: "الدفع قريباً" },
    verified: { en: "Verified", ar: "موثّق" },
    minutes: { en: "min", ar: "د" },
    quickPreview: { en: "Quick preview", ar: "معاينة سريعة" },
  },
  explore: {
    subtitle: {
      en: "Verified Jojo resources for your AI workflow.",
      ar: "موارد جوجو موثّقة لسير عملك مع الذكاء الاصطناعي.",
    },
  },

  detail: {
    back: { en: "Back", ar: "رجوع" },
    overview: { en: "Overview", ar: "نظرة عامة" },
    platforms: { en: "Platforms & Compatibility", ar: "المنصات والتوافق" },
    installation: { en: "Installation", ar: "التثبيت" },
    permissions: { en: "Permissions & Dependencies", ar: "الأذونات والاعتمادات" },
    license: { en: "License", ar: "الترخيص" },
    downloads: { en: "Downloads", ar: "التنزيلات" },
    required: { en: "Required", ar: "مطلوب" },
    optional: { en: "Optional", ar: "اختياري" },
    stepsUnavailable: {
      en: "Installation steps unavailable.",
      ar: "خطوات التثبيت غير متاحة.",
    },
    openInLibrary: { en: "Open in Library", ar: "افتح في المكتبة" },
    lifetimeCallout: {
      en: "Spend {threshold} KD across resources to unlock every current and future Jojo resource.",
      ar: "أنفق {threshold} د.ك على الموارد لفتح كل مورد جوجو الحالي والمستقبلي.",
    },
    lifetimeTitle: { en: "Lifetime access", ar: "وصول مدى الحياة" },
  },
  library: {
    title: { en: "My Library", ar: "مكتبتي" },
    subtitle: {
      en: "Your entitled resources, downloads, and lifetime progress.",
      ar: "مواردك المُخوَّلة، التنزيلات، وتقدُّم مدى الحياة.",
    },
    empty: {
      en: "Nothing here yet. Browse the catalog to add free or paid resources.",
      ar: "لا يوجد شيء هنا بعد. تصفّح المتجر لإضافة موارد مجانية أو مدفوعة.",
    },
    inactive: { en: "Inactive access", ar: "وصول غير مفعّل" },
    inactiveDesc: {
      en: "Access to these resources has ended and files can no longer be downloaded.",
      ar: "انتهى الوصول لهذه الموارد ولا يمكن تنزيل الملفات.",
    },
    revoked: { en: "Revoked", ar: "مُلغى" },
    expired: { en: "Expired", ar: "منتهي" },
    lifetimeBadge: { en: "Lifetime included", ar: "ضمن مدى الحياة" },
    individualBadge: { en: "Individual", ar: "فردي" },
    noPackage: {
      en: "No downloadable package for your entitled version yet.",
      ar: "لا توجد حزمة قابلة للتنزيل لإصدارك بعد.",
    },
    retry: { en: "Retry", ar: "أعد المحاولة" },
    loadError: {
      en: "Something went wrong loading your library.",
      ar: "حدث خطأ أثناء تحميل مكتبتك.",
    },
  },
  states: {
    emptyCatalogTitle: {
      en: "The V2 catalog is launching soon",
      ar: "متجر V2 قادم قريباً",
    },
    emptyCatalogDesc: {
      en: "We're preparing verified skills, automations, prompts, image styles, and bundles. Check back shortly.",
      ar: "نُعدّ مهارات وأتمتة وبرومبتات وأنماط صور وحزم موثّقة. عُد قريباً.",
    },
    noResultsTitle: {
      en: "No matches for your filters",
      ar: "لا نتائج لهذه الفلاتر",
    },
    noResultsDesc: {
      en: "Try clearing search, price or platform filters.",
      ar: "جرّب مسح البحث أو فلاتر السعر أو المنصات.",
    },
    error: {
      en: "Something went wrong loading the catalog.",
      ar: "حدث خطأ أثناء تحميل المتجر.",
    },
  },
} as const;

export function copy(entry: CopyEntry, lang: Lang): string {
  return entry[lang];
}
