import ExplorePage from "./ExplorePage";
export default function PromptsCatalogPage() {
  return (
    <ExplorePage
      fixedType="prompt"
      title="Prompts"
      emptyTitle={{ en: "No published prompts yet", ar: "لا توجد برومبتات منشورة بعد" }}
      emptyDesc={{
        en: "Verified Jojo prompts will appear here as soon as they're published.",
        ar: "ستظهر برومبتات جوجو الموثّقة هنا فور نشرها.",
      }}
    />
  );
}
