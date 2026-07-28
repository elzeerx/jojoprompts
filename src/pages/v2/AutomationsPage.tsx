import ExplorePage from "./ExplorePage";
export default function AutomationsPage() {
  return (
    <ExplorePage
      fixedType="automation"
      title={{ en: "Automations", ar: "الأتمتة" }}
      canonicalPath="/automations"
      seoTitle={{
        en: "AI automations & workflows — pay once, keep forever",
        ar: "أتمتة وسِيَر عمل ذكاء اصطناعي — ادفع مرة، امتلك للأبد",
      }}
      seoDescription={{
        en: "End-to-end automations and workflows built by Jojo. One-time payment, permanent ownership, verified files.",
        ar: "أتمتة وسِيَر عمل متكاملة من صنع جوجو. دفع لمرة واحدة، ملكية دائمة، وملفات موثّقة.",
      }}
      emptyTitle={{ en: "No published automations yet", ar: "لا توجد أتمتات منشورة بعد" }}
      emptyDesc={{
        en: "Verified Jojo automations will appear here as soon as they're published.",
        ar: "ستظهر أتمتات جوجو الموثّقة هنا فور نشرها.",
      }}
    />
  );
}
