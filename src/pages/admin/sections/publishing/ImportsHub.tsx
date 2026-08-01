/* eslint-disable react-refresh/only-export-components -- card metadata is a pure exported UI contract. */
import { Link } from "react-router-dom";
import { FileJson, Sparkles, Archive, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";

type HubCard = {
  key: "json" | "ai-studio" | "legacy";
  to: string;
  icon: typeof FileJson;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
};

export const IMPORTS_HUB_CARDS: readonly HubCard[] = [
  {
    key: "json",
    to: "/admin/content?tool=import-json",
    icon: FileJson,
    title: "JSON Importer",
    titleAr: "مستورد JSON",
    description: "Import V2 resources from validated JSON.",
    descriptionAr: "استيراد موارد V2 من ملفات JSON مُتحقَّق منها.",
  },
  {
    key: "ai-studio",
    to: "/admin/content?tool=ai-studio",
    icon: Sparkles,
    title: "AI Studio",
    titleAr: "استوديو الذكاء الاصطناعي",
    description: "Generate/prepare resources through the unified publisher workflow.",
    descriptionAr: "توليد وتحضير الموارد من خلال سير عمل النشر الموحّد.",
  },
  {
    key: "legacy",
    to: "/admin/content?tool=import-legacy",
    icon: Archive,
    title: "Legacy migration verification",
    titleAr: "التحقّق من الترحيل القديم",
    description: "Read-only historical verification/audit.",
    descriptionAr: "تحقُّق وتدقيق تاريخي للقراءة فقط.",
  },
];

export default function ImportsHub() {
  const { dir, language } = useLanguage();
  const isAr = language === "ar";

  return (
    <div className="space-y-6" dir={dir}>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Imports{isAr ? " / الاستيراد" : ""}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isAr
            ? "أدوات الاستيراد الموحّدة لموارد V2."
            : "Unified import tools for V2 resources."}
        </p>
      </header>

      <nav aria-label="Imports tools" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {IMPORTS_HUB_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.key}
              to={card.to}
              data-imports-hub-card={card.key}
              className="group block min-h-[44px] rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={`${card.title} — ${card.description}`}
            >
              <Card className="h-full min-h-[44px] transition-colors group-focus-visible:border-primary group-hover:border-primary">
                <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                  <div className="rounded-md border bg-muted p-2 text-foreground">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <CardTitle className="text-base">
                      {card.title}
                      {isAr ? ` / ${card.titleAr}` : ""}
                    </CardTitle>
                    <CardDescription>
                      {card.description}
                      {isAr ? ` — ${card.descriptionAr}` : ""}
                    </CardDescription>
                  </div>
                  <ArrowRight
                    className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                    aria-hidden="true"
                  />
                </CardHeader>
                <CardContent className="pt-0 text-xs text-muted-foreground">
                  {card.key === "legacy"
                    ? isAr
                      ? "لا توجد إجراءات تنفيذية — عرض للقراءة فقط."
                      : "No execution actions — read-only view."
                    : null}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
