import ExplorePage from "./ExplorePage";

/**
 * Renders at /prompts (canonical). /prompts-catalog is a compatibility
 * redirect that resolves here — see LEGACY_REDIRECTS in App.tsx.
 */
export default function PromptsCatalogPage() {
  return (
    <ExplorePage
      fixedType="prompt"
      title={{ en: "Prompts", ar: "البرومبتات" }}
      canonicalPath="/prompts"
      seoTitle={{
        en: "AI prompts — verified, ownable prompt library",
        ar: "برومبتات ذكاء اصطناعي — مكتبة موثّقة يمكن امتلاكها",
      }}
      seoDescription={{
        en: "Individual prompts and curated packs from Jojo — pay once, keep forever, no subscription.",
        ar: "برومبتات فردية وحزم منسّقة من جوجو — دفع لمرة واحدة، ملكية دائمة، بلا اشتراك.",
      }}
      emptyTitle={{ en: "No published prompts yet", ar: "لا توجد برومبتات منشورة بعد" }}
      emptyDesc={{
        en: "Verified Jojo prompts will appear here as soon as they're published.",
        ar: "ستظهر برومبتات جوجو الموثّقة هنا فور نشرها.",
      }}
    />
  );
}
