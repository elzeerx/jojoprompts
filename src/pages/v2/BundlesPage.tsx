import ExplorePage from "./ExplorePage";
export default function BundlesPage() {
  return (
    <ExplorePage
      fixedType="bundle"
      title="Bundles"
      emptyTitle={{ en: "No published bundles yet", ar: "لا توجد حزم منشورة بعد" }}
      emptyDesc={{
        en: "Curated Jojo bundles will appear here as soon as they're published.",
        ar: "ستظهر حزم جوجو المنسّقة هنا فور نشرها.",
      }}
    />
  );
}
