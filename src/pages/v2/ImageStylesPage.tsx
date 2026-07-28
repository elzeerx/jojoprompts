import ExplorePage from "./ExplorePage";
export default function ImageStylesPage() {
  return (
    <ExplorePage
      fixedType="image_style"
      title="Image Styles"
      canonicalPath="/image-styles"
      seoTitle={{
        en: "AI image styles — consistent, ownable style packs",
        ar: "أنماط صور ذكاء اصطناعي — حزم أنماط ثابتة يمكن امتلاكها",
      }}
      seoDescription={{
        en: "Reusable image styles from Jojo for consistent AI generations. One-time payment, permanent library.",
        ar: "أنماط صور قابلة لإعادة الاستخدام من جوجو لنتائج ثابتة. دفع لمرة واحدة، مكتبة دائمة.",
      }}
      emptyTitle={{ en: "No published image styles yet", ar: "لا توجد أنماط صور منشورة بعد" }}
      emptyDesc={{
        en: "Verified Jojo image styles will appear here as soon as they're published.",
        ar: "ستظهر أنماط الصور الموثّقة هنا فور نشرها.",
      }}
    />
  );
}
