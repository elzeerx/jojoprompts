import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { V2_COPY } from "@/config/v2Flags";
import { CartIconButton } from "@/components/v2/CartIconButton";

interface NavItem {
  to: string;
  label: { en: string; ar: string };
  auth?: boolean;
  end?: boolean;
}

const CATEGORY_LINKS: NavItem[] = [
  { to: "/explore", label: V2_COPY.nav.explore, end: true },
  { to: "/explore?type=skill", label: V2_COPY.nav.skills },
  { to: "/explore?type=automation", label: V2_COPY.nav.automations },
  { to: "/explore?type=prompt", label: V2_COPY.nav.prompts },
  { to: "/explore?type=image_style", label: V2_COPY.nav.imageStyles },
  { to: "/explore?type=bundle", label: V2_COPY.nav.bundles },
];

const SECONDARY_LINKS: NavItem[] = [
  { to: "/pricing", label: { en: "Pricing", ar: "الأسعار" } },
  { to: "/library", label: V2_COPY.nav.library, auth: true },
  { to: "/orders", label: { en: "Orders", ar: "طلباتي" }, auth: true },
];

export function V2SubNav({ authed }: { authed: boolean }) {
  const { language, isRTL } = useTranslation();
  const location = useLocation();
  const items = [
    ...CATEGORY_LINKS,
    ...SECONDARY_LINKS.filter((l) => !l.auth || authed),
  ];
  return (
    <nav
      className="sticky top-16 lg:top-18 z-30 w-full border-b border-border/50 bg-background/95 backdrop-blur"
      dir={isRTL ? "rtl" : "ltr"}
      aria-label="V2 catalog navigation"
    >
      <div className="container mx-auto flex items-center gap-1 overflow-x-auto px-3 py-2">
        {items.map((l) => {
          const [path, query = ""] = l.to.split("?");
          const expectedType = new URLSearchParams(query).get("type");
          const currentType = new URLSearchParams(location.search).get("type");
          const isActive = location.pathname === path && (path !== "/explore" || expectedType === currentType);
          return (
          <Link
            key={l.to}
            to={l.to}
            aria-current={isActive ? "page" : undefined}
            className={cn(
                "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors min-h-[44px] flex items-center",
                isActive
                  ? "bg-warm-gold text-dark-base"
                  : "text-muted-foreground hover:bg-muted",
              )}
          >
            {l.label[language as "en" | "ar"] ?? l.label.en}
          </Link>
        )})}
        <div className="ms-auto shrink-0">
          <CartIconButton />
        </div>
      </div>
    </nav>
  );
}
