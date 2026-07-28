import ExplorePage from "./ExplorePage";
export default function BundlesPage() {
  return (
    <ExplorePage
      fixedType="bundle"
      title={{ en: "Bundles", ar: "الحزم" }}
      canonicalPath="/bundles"
      seoTitle={{
        en: "AI bundles — curated resource collections at a better price",
        ar: "حزم ذكاء اصطناعي — مجموعات موارد منسّقة بسعر أفضل",
      }}
      seoDescription={{
        en: "Curated bundles of Jojo skills, automations, prompts, and image styles. Own them all forever.",
        ar: "حزم منسّقة تجمع مهارات وأتمتة وبرومبتات وأنماط صور من جوجو — تمتلكها للأبد.",
      }}
      emptyTitle={{ en: "No published bundles yet", ar: "لا توجد حزم منشورة بعد" }}
      emptyDesc={{
        en: "Curated Jojo bundles will appear here as soon as they're published.",
        ar: "ستظهر الحزم المنسّقة من جوجو هنا فور نشرها.",
      }}
    />
  );
}
