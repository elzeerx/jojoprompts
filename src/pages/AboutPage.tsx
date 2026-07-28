import { Link } from "react-router-dom";
import {
  FileText,
  LibraryBig,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeoHead } from "@/components/v2/SeoHead";
import { useTranslation } from "@/hooks/useTranslation";

export default function AboutPage() {
  const { language, isRTL } = useTranslation();
  const lang: "en" | "ar" = language === "ar" ? "ar" : "en";
  const t = aboutCopy(lang);

  const principles = [
    { icon: Sparkles, title: t.curatedTitle, description: t.curatedDescription },
    { icon: ShieldCheck, title: t.trustTitle, description: t.trustDescription },
    { icon: LibraryBig, title: t.ownershipTitle, description: t.ownershipDescription },
  ];
  const catalog = [
    { icon: PackageCheck, title: t.skillsTitle, description: t.skillsDescription },
    { icon: Workflow, title: t.automationTitle, description: t.automationDescription },
    { icon: FileText, title: t.promptsTitle, description: t.promptsDescription },
    { icon: LibraryBig, title: t.libraryTitle, description: t.libraryDescription },
  ];

  return (
    <main dir={isRTL ? "rtl" : "ltr"} className="bg-background text-foreground">
      <SeoHead
        title={t.seoTitle}
        description={t.seoDescription}
        canonicalPath="/about"
      />

      <section className="border-b border-border/60 bg-gradient-to-b from-warm-gold/10 to-transparent">
        <div className="container mx-auto max-w-4xl px-4 py-12 text-center sm:py-16">
          <FileText className="mx-auto h-9 w-9 text-warm-gold" aria-hidden />
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            {t.title}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t.subtitle}
          </p>
        </div>
      </section>

      <div className="container mx-auto max-w-5xl space-y-12 px-4 py-10 sm:py-14">
        <section className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-semibold">{t.storyTitle}</h2>
          <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            <p>{t.storyOne}</p>
            <p>{t.storyTwo}</p>
          </div>
        </section>

        <section aria-labelledby="about-principles">
          <h2 id="about-principles" className="text-2xl font-semibold">
            {t.principlesTitle}
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {principles.map((item) => (
              <article key={item.title} className="rounded-2xl border bg-card p-5">
                <item.icon className="h-6 w-6 text-warm-gold" aria-hidden />
                <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="about-catalog">
          <h2 id="about-catalog" className="text-2xl font-semibold">
            {t.catalogTitle}
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {catalog.map((item) => (
              <article key={item.title} className="rounded-2xl border bg-card p-5">
                <div className="flex items-start gap-3">
                  <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-warm-gold" aria-hidden />
                  <div>
                    <h3 className="font-semibold">{item.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-warm-gold/40 bg-warm-gold/5 p-6">
          <h2 className="text-xl font-semibold">{t.scopeTitle}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t.scopeDescription}
          </p>
        </section>

        <section className="text-center">
          <h2 className="text-2xl font-semibold">{t.ctaTitle}</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            {t.ctaDescription}
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild className="min-h-[44px] bg-warm-gold text-dark-base hover:bg-warm-gold/90">
              <Link to="/explore">{t.explore}</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-[44px]">
              <Link to="/how-it-works">{t.howItWorks}</Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}

function aboutCopy(lang: "en" | "ar") {
  if (lang === "ar") {
    return {
      seoTitle: "عن JojoPrompts — موارد ذكاء اصطناعي تمتلكها للأبد",
      seoDescription:
        "تعرّف على JojoPrompts V2: مهارات وأتمتة وبرومبتات وأنماط صور وحزم من جوجو، بدفعة واحدة وملكية دائمة.",
      title: "عن JojoPrompts",
      subtitle:
        "مكتبة عملية لموارد الذكاء الاصطناعي التي تساعدك على إنجاز عمل حقيقي — واضحة، موثّقة، ومملوكة لك بعد دفع واحد.",
      storyTitle: "لماذا تطوّرنا إلى V2",
      storyOne:
        "بدأ JojoPrompts كمكتبة لبرومبتات النص والصور. لكن استخدام الذكاء الاصطناعي تطوّر: الناس اليوم يثبتون مهارات، يشغّلون وكلاء، ويربطون خطوات كاملة في أتمتة وسِيَر عمل.",
      storyTwo:
        "لذلك تجمع V2 المهارات والأتمتة والبرومبتات وأنماط الصور والحزم في كتالوج واحد، مع توافق المنصّات، تعليمات التثبيت، الأذونات، الإصدارات، وفحص الحزم قبل التنزيل.",
      principlesTitle: "ما الذي نلتزم به",
      curatedTitle: "موارد منتقاة ومختبرة",
      curatedDescription:
        "كل مورد تنشره جوجو له نتيجة واضحة، وصف عملي، وأمثلة تساعدك على معرفة فائدته قبل الحصول عليه.",
      trustTitle: "شفافية قبل التنزيل",
      trustDescription:
        "نعرض المنصّات المتوافقة، الاعتماديات، الأذونات، حالة الفحص، الإصدار، وبصمة الملف عندما تنطبق.",
      ownershipTitle: "ادفع مرة وامتلك",
      ownershipDescription:
        "لا اشتراكات ولا رسوم متكررة. الموارد المجانية والمدفوعة تُضاف كاستحقاقات دائمة إلى مكتبتك.",
      catalogTitle: "ما ستجده في JojoPrompts",
      skillsTitle: "مهارات",
      skillsDescription:
        "حزم وإعدادات جاهزة لمنصّات مثل Claude وChatGPT وCodex وGemini وHermes وKimi.",
      automationTitle: "أتمتة وسِيَر عمل",
      automationDescription:
        "خطوات مترابطة تساعدك على تشغيل مهمة متكررة أو عملية كاملة بطريقة واضحة وقابلة للتنفيذ.",
      promptsTitle: "برومبتات وأنماط صور وحزم",
      promptsDescription:
        "برومبتات فردية، حزم منظّمة، وأنماط صور تساعدك على إنتاج نتائج متناسقة.",
      libraryTitle: "مكتبتك الدائمة",
      libraryDescription:
        "مكان واحد للتنزيل، تعليمات التثبيت، الإصدارات، التحديثات المؤهلة، التراخيص، والإيصالات.",
      scopeTitle: "نطاق V2.0",
      scopeDescription:
        "كتالوج V2.0 تشغّله جوجو ويضم موارد مملوكة لجوجو فقط. مساهمات المبدعين وسوق المبدعين المدفوع مؤجلان إلى إصدارات لاحقة، لذلك لا نعرض حالياً ملفات مبدعين أو عمولات أو وعود أرباح.",
      ctaTitle: "ابدأ بما تحتاجه فعلاً",
      ctaDescription:
        "تصفّح بدون حساب، ثم سجّل الدخول فقط عندما تريد الحصول على مورد أو تنزيله أو إضافته إلى مكتبتك.",
      explore: "استكشف الموارد",
      howItWorks: "اعرف كيف يعمل",
    };
  }
  return {
    seoTitle: "About JojoPrompts — AI resources you own",
    seoDescription:
      "Meet JojoPrompts V2: Jojo-built skills, automations, prompts, image styles, and bundles with one-time payment and permanent ownership.",
    title: "About JojoPrompts",
    subtitle:
      "A practical library of AI resources that help you do real work—clearly documented, verified, and yours after one payment.",
    storyTitle: "Why we evolved into V2",
    storyOne:
      "JojoPrompts began as a library for text and image prompts. AI use has moved forward: people now install skills, run agents, and connect complete tasks through automations and workflows.",
    storyTwo:
      "V2 brings skills, automations, prompts, image styles, and bundles into one catalog, with platform compatibility, installation instructions, permissions, versions, and package scanning before download.",
    principlesTitle: "What we commit to",
    curatedTitle: "Curated and tested resources",
    curatedDescription:
      "Every Jojo-published resource has a clear outcome, practical description, and examples that help you judge its value before acquiring it.",
    trustTitle: "Transparency before download",
    trustDescription:
      "We show compatible platforms, dependencies, permissions, scan state, version, and file checksum whenever they apply.",
    ownershipTitle: "Pay once and own",
    ownershipDescription:
      "No subscriptions and no recurring fees. Free and paid acquisitions become permanent entitlements in your library.",
    catalogTitle: "What you will find on JojoPrompts",
    skillsTitle: "Skills",
    skillsDescription:
      "Ready-to-use packages and configurations for platforms such as Claude, ChatGPT, Codex, Gemini, Hermes, and Kimi.",
    automationTitle: "Automations and workflows",
    automationDescription:
      "Connected steps that help you run a repeatable task or a complete process in a clear, usable way.",
    promptsTitle: "Prompts, image styles, and bundles",
    promptsDescription:
      "Individual prompts, structured packs, and image styles for producing consistent results.",
    libraryTitle: "Your permanent library",
    libraryDescription:
      "One place for downloads, installation guides, versions, eligible updates, licenses, and receipts.",
    scopeTitle: "V2.0 scope",
    scopeDescription:
      "V2.0 is a Jojo-operated catalog containing Jojo-owned resources only. Creator contributions and the paid creator marketplace are reserved for later releases, so there are no creator listings, commissions, or earnings promises today.",
    ctaTitle: "Start with what you actually need",
    ctaDescription:
      "Browse without an account, then sign in only when you want to acquire, download, or add a resource to your library.",
    explore: "Explore resources",
    howItWorks: "See how it works",
  };
}
