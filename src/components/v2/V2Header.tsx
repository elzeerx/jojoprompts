import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Menu, X, User, LogOut, Settings, LibraryBig, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { CartIconButton } from "@/components/v2/CartIconButton";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import headerLogoDark from "@/assets/logo-header-dark.png";

interface NavItem {
  to: string;
  label: { en: string; ar: string };
  end?: boolean;
  authOnly?: boolean;
}

const PRIMARY_NAV: NavItem[] = [
  { to: "/", label: { en: "Home", ar: "الرئيسية" }, end: true },
  { to: "/explore", label: { en: "Explore", ar: "استكشف" } },
  { to: "/skills", label: { en: "Skills", ar: "مهارات" } },
  { to: "/automations", label: { en: "Automations", ar: "أتمتة" } },
  { to: "/prompts-catalog", label: { en: "Prompts", ar: "برومبتات" } },
  { to: "/image-styles", label: { en: "Image Styles", ar: "أنماط الصور" } },
  { to: "/bundles", label: { en: "Bundles", ar: "حزم" } },
  { to: "/pricing", label: { en: "Pricing", ar: "الأسعار" } },
];

const AUTHED_NAV: NavItem[] = [
  { to: "/library", label: { en: "My Library", ar: "مكتبتي" }, authOnly: true },
  { to: "/orders", label: { en: "Orders", ar: "طلباتي" }, authOnly: true },
];

export function V2Header() {
  const [open, setOpen] = useState(false);
  const { language, isRTL } = useTranslation();
  const lang: "en" | "ar" = language === "ar" ? "ar" : "en";
  const navigate = useNavigate();

  let user: any = null;
  let isAdmin = false;
  let signOut = async () => {};
  try {
    const a = useAuth();
    user = a.user;
    isAdmin = a.isAdmin;
    signOut = a.signOut;
  } catch {
    /* no auth context */
  }

  const items = [...PRIMARY_NAV, ...AUTHED_NAV.filter((n) => !!user)];

  return (
    <header
      className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/95 backdrop-blur"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="container mx-auto flex h-16 items-center gap-2 px-3 lg:h-18 lg:px-4">
        <Link
          to="/"
          className="flex items-center min-h-[44px] min-w-[44px] shrink-0"
          aria-label="JojoPrompts home"
        >
          <img src={headerLogoDark} alt="JojoPrompts" className="h-8 w-auto sm:h-10" />
        </Link>

        {/* Desktop nav */}
        <nav
          aria-label="Primary"
          className="ms-4 hidden flex-1 items-center gap-1 overflow-x-auto lg:flex"
        >
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "shrink-0 rounded-full px-3 py-2 text-sm font-medium transition-colors min-h-[44px] inline-flex items-center",
                  isActive
                    ? "bg-warm-gold text-dark-base"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )
              }
            >
              {item.label[lang]}
            </NavLink>
          ))}
        </nav>

        <div className={cn("ms-auto flex items-center gap-1 sm:gap-2", isRTL && "flex-row-reverse")}>
          <LanguageSwitcher variant="desktop" />
          <CartIconButton />
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  aria-label={lang === "ar" ? "الحساب" : "Account"}
                  className="relative h-11 w-11 rounded-full min-h-[44px] min-w-[44px] p-0"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-warm-gold text-white font-medium text-sm">
                      {user.email?.charAt(0).toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => navigate("/library")}>
                  <LibraryBig className="me-2 h-4 w-4 text-warm-gold" />
                  {lang === "ar" ? "مكتبتي" : "My Library"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/orders")}>
                  <Receipt className="me-2 h-4 w-4 text-warm-gold" />
                  {lang === "ar" ? "طلباتي" : "Orders"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                  <User className="me-2 h-4 w-4 text-warm-gold" />
                  {lang === "ar" ? "لوحة التحكم" : "Dashboard"}
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem onClick={() => navigate("/admin")}>
                    <Settings className="me-2 h-4 w-4 text-warm-gold" />
                    {lang === "ar" ? "لوحة المشرف" : "Admin Dashboard"}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void signOut()}>
                  <LogOut className="me-2 h-4 w-4 text-warm-gold" />
                  {lang === "ar" ? "تسجيل الخروج" : "Sign out"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              onClick={() => navigate("/login")}
              className="min-h-[44px] bg-warm-gold text-dark-base hover:bg-warm-gold/90"
            >
              {lang === "ar" ? "تسجيل الدخول" : "Sign in"}
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            aria-label={open ? "Close menu" : "Open menu"}
            className="lg:hidden min-h-[44px] min-w-[44px]"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {open && (
        <nav
          aria-label="Mobile primary"
          className="lg:hidden border-t border-border/60 bg-background/95 backdrop-blur"
        >
          <ul className="container mx-auto flex flex-col gap-1 px-3 py-2">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center rounded-lg px-3 py-3 text-sm font-medium min-h-[44px]",
                      isActive
                        ? "bg-warm-gold text-dark-base"
                        : "text-foreground hover:bg-muted",
                    )
                  }
                >
                  {item.label[lang]}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
