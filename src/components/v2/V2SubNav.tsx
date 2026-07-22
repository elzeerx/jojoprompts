import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

const LINKS = [
  { to: "/explore", label_en: "Explore", label_ar: "استكشف" },
  { to: "/skills", label_en: "Skills", label_ar: "مهارات" },
  { to: "/automations", label_en: "Automations", label_ar: "أتمتة" },
  { to: "/prompts-catalog", label_en: "Prompts", label_ar: "برومبتات" },
  { to: "/image-styles", label_en: "Image Styles", label_ar: "أنماط الصور" },
  { to: "/bundles", label_en: "Bundles", label_ar: "حزم" },
  { to: "/library", label_en: "My Library", label_ar: "مكتبتي", auth: true },
];

export function V2SubNav({ authed }: { authed: boolean }) {
  const { language, isRTL } = useTranslation();
  return (
    <nav
      className="sticky top-16 z-30 w-full border-b border-border/50 bg-background/95 backdrop-blur"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="container mx-auto flex gap-1 overflow-x-auto px-3 py-2">
        {LINKS.filter((l) => !l.auth || authed).map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === "/explore"}
            className={({ isActive }) =>
              cn(
                "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors min-h-[44px] flex items-center",
                isActive
                  ? "bg-warm-gold text-dark-base"
                  : "text-muted-foreground hover:bg-muted",
              )
            }
          >
            {language === "ar" ? l.label_ar : l.label_en}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
