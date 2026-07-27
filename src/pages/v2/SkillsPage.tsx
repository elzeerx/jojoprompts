import ExplorePage from "./ExplorePage";
export default function SkillsPage() {
  return (
    <ExplorePage
      fixedType="skill"
      title="Skills"
      emptyTitle={{ en: "No published skills yet", ar: "لا توجد مهارات منشورة بعد" }}
      emptyDesc={{
        en: "Verified Jojo skills will appear here as soon as they're published. Meanwhile, browse the wider catalog.",
        ar: "ستظهر مهارات جوجو الموثّقة هنا فور نشرها. في الأثناء، تصفّح باقي المتجر.",
      }}
    />
  );
}
