import { Link } from "react-router-dom";
import { Instagram, Twitter } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

/**
 * V2 public footer. All interactive elements meet the 44px mobile touch
 * target. The "Sign in" account entry is hidden for authenticated visitors,
 * who instead see Account / My Library / Orders links.
 */
export function V2Footer() {
  const year = new Date().getFullYear();
  const { language, isRTL } = useTranslation();
  const lang: "en" | "ar" = language === "ar" ? "ar" : "en";

  const { user } = useAuth();
  const isAuthed = !!user;


  const t = {
    tagline:
      lang === "ar"
        ? "منصة جوجو للذكاء الاصطناعي: مهارات، أتمتة، برومبتات، أنماط صور وحزم موثّقة — ادفع مرة واحدة، امتلك مدى الحياة."
        : "Jojo's AI marketplace: verified skills, automations, prompts, image styles, and bundles. Buy once, own forever.",
    explore: lang === "ar" ? "استكشف" : "Explore",
    account: lang === "ar" ? "الحساب" : "Account",
    legal: lang === "ar" ? "قانوني" : "Legal",
    copyright:
      lang === "ar"
        ? `© ${year} JojoPrompts. جميع الحقوق محفوظة.`
        : `© ${year} JojoPrompts. All rights reserved.`,
  };

  const exploreLinks: Array<{ to: string; label: string }> = [
    { to: "/explore", label: lang === "ar" ? "المتجر" : "All resources" },
    { to: "/explore?type=skill", label: lang === "ar" ? "المهارات" : "Skills" },
    { to: "/explore?type=automation", label: lang === "ar" ? "الأتمتة" : "Automations" },
    { to: "/explore?type=prompt", label: lang === "ar" ? "البرومبتات" : "Prompts" },
    { to: "/explore?type=image_style", label: lang === "ar" ? "أنماط الصور" : "Image styles" },
    { to: "/explore?type=bundle", label: lang === "ar" ? "الحزم" : "Bundles" },
    { to: "/how-it-works", label: lang === "ar" ? "كيف يعمل" : "How it works" },
    { to: "/pricing", label: lang === "ar" ? "الأسعار" : "Pricing" },
  ];

  const accountLinks: Array<{ to: string; label: string }> = isAuthed
    ? [
        { to: "/library", label: lang === "ar" ? "مكتبتي" : "My Library" },
        { to: "/orders", label: lang === "ar" ? "طلباتي" : "Orders" },
        { to: "/cart", label: lang === "ar" ? "السلة" : "Cart" },
        { to: "/account", label: lang === "ar" ? "حسابي" : "My account" },
      ]
    : [
        { to: "/library", label: lang === "ar" ? "مكتبتي" : "My Library" },
        { to: "/cart", label: lang === "ar" ? "السلة" : "Cart" },
        { to: "/login", label: lang === "ar" ? "تسجيل الدخول" : "Sign in" },
      ];

  const legalLinks: Array<{ to: string; label: string }> = [
    { to: "/privacy", label: lang === "ar" ? "سياسة الخصوصية" : "Privacy" },
    { to: "/terms", label: lang === "ar" ? "شروط الاستخدام" : "Terms" },
    { to: "/contact", label: lang === "ar" ? "اتصل بنا" : "Contact" },
  ];

  return (
    <footer
      className="bg-dark-base text-soft-bg mt-16"
      dir={isRTL ? "rtl" : "ltr"}
      aria-label="Site footer"
      data-testid="v2-footer"
      data-authed={isAuthed ? "true" : "false"}
    >
      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <div className="text-2xl font-bold text-warm-gold">JojoPrompts</div>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-soft-bg/80">{t.tagline}</p>
            <div className={cn("mt-4 flex gap-3", isRTL && "flex-row-reverse")}>
              <a
                href="https://instagram.com/jojoprompts"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-soft-bg/80 hover:bg-warm-gold/10 hover:text-warm-gold min-h-[44px] min-w-[44px]"
              >
                <Instagram className="h-5 w-5" />
              </a>
              <a
                href="https://x.com/jojoprompts"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X / Twitter"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-soft-bg/80 hover:bg-warm-gold/10 hover:text-warm-gold min-h-[44px] min-w-[44px]"
              >
                <Twitter className="h-5 w-5" />
              </a>
            </div>
          </div>

          <FooterColumn title={t.explore} links={exploreLinks} />
          <div className="grid grid-cols-1 gap-8">
            <FooterColumn title={t.account} links={accountLinks} />
            <FooterColumn title={t.legal} links={legalLinks} />
          </div>
        </div>

        <div className="mt-10 border-t border-soft-bg/10 pt-6 text-center text-sm text-soft-bg/70">
          {t.copyright}
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<{ to: string; label: string }>;
}) {
  return (
    <div>
      <h3 className="mb-3 text-base font-semibold text-warm-gold">{title}</h3>
      <ul className="space-y-1">
        {links.map((l) => (
          <li key={l.to}>
            <Link
              to={l.to}
              data-testid="v2-footer-link"
              className="inline-flex min-h-[44px] w-full items-center py-2 text-sm text-soft-bg/80 hover:text-warm-gold"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
