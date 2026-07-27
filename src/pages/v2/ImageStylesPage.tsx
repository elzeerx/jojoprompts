import ExplorePage from "./ExplorePage";
export default function ImageStylesPage() {
  return (
    <ExplorePage
      fixedType="image_style"
      title="Image Styles"
      emptyTitle={{ en: "No published image styles yet", ar: "لا توجد أنماط صور منشورة بعد" }}
      emptyDesc={{
        en: "Verified Jojo image styles will appear here as soon as they're published.",
        ar: "ستظهر أنماط الصور الموثّقة هنا فور نشرها.",
      }}
    />
  );
}
