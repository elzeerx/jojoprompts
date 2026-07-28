import ExplorePage from "./ExplorePage";
export default function SkillsPage() {
  return (
    <ExplorePage
      fixedType="skill"
      title={{ en: "Skills", ar: "المهارات" }}
      canonicalPath="/skills"
      seoTitle={{
        en: "AI skills — ready-made assistant setups",
        ar: "مهارات ذكاء اصطناعي — إعدادات مساعد جاهزة",
      }}
      seoDescription={{
        en: "Buy verified Jojo skills once and own them forever — ready-made setups for Claude, ChatGPT, Codex, Gemini, and more.",
        ar: "اشترِ مهارات جوجو الموثّقة مرة واحدة وامتلكها للأبد — إعدادات جاهزة لـ Claude وChatGPT وCodex وGemini وغيرها.",
      }}
      emptyTitle={{ en: "No published skills yet", ar: "لا توجد مهارات منشورة بعد" }}
      emptyDesc={{
        en: "Verified Jojo skills will appear here as soon as they're published. Meanwhile, browse the wider catalog.",
        ar: "ستظهر مهارات جوجو الموثّقة هنا فور نشرها. في الأثناء، تصفّح باقي المتجر.",
      }}
    />
  );
}
