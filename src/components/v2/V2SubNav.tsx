import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { V2_COPY } from "@/config/v2Flags";

interface NavItem {
  to: string;
  label: { en: string; ar: string };
  auth?: boolean;
  end?: boolean;
}

const CATEGORY_LINKS: NavItem[] = [
  { to: "/explore", label: V2_COPY.nav.explore, end: true },
  { to: "/skills", label: V2_COPY.nav.skills },
  { to: "/automations", label: V2_COPY.nav.automations },
  { to: "/prompts-catalog", label: V2_COPY.nav.prompts },
  { to: "/image-styles", label: V2_COPY.nav.imageStyles },
  { to: "/bundles", label: V2_COPY.nav.bundles },
];

const CONTEXT_LINKS: NavItem[] = [
  { to: "/library", label: V2_COPY.nav.library, auth: true },
];

export function V2SubNav({ authed }: { authed: boolean }) {
  const { language, isRTL } = useTranslation();
  const items = [
    ...CATEGORY_LINKS,
    ...CONTEXT_LINKS.filter((l) => !l.auth || authed),
  ];
  return (
    <nav
      className="sticky top-16 z-30 w-full border-b border-border/50 bg-background/95 backdrop-blur"
      dir={isRTL ? "rtl" : "ltr"}
      aria-label="V2 catalog navigation"
    >
      <div className="container mx-auto flex gap-1 overflow-x-auto px-3 py-2">
        {items.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) =>
              cn(
                "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors min-h-[44px] flex items-center",
                isActive
                  ? "bg-warm-gold text-dark-base"
                  : "text-muted-foreground hover:bg-muted",
              )
            }
          >
            {l.label[language as "en" | "ar"] ?? l.label.en}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
