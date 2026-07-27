import ExplorePage from "./ExplorePage";
export default function AutomationsPage() {
  return (
    <ExplorePage
      fixedType="automation"
      title="Automations"
      emptyTitle={{ en: "No published automations yet", ar: "لا توجد أتمتات منشورة بعد" }}
      emptyDesc={{
        en: "Verified Jojo automations and workflows will appear here as soon as they're published.",
        ar: "ستظهر أتمتات جوجو وسير العمل الموثّق هنا فور نشرها.",
      }}
    />
  );
}
