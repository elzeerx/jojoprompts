import { useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SeoHead } from "@/components/v2/SeoHead";
import { useTranslation } from "@/hooks/useTranslation";

type FaqCategory = "all" | "getting_started" | "ownership" | "resources" | "payments" | "safety";

interface FaqItem {
  id: string;
  category: Exclude<FaqCategory, "all">;
  question: string;
  answer: string;
}

export default function FAQPage() {
  const { language, isRTL } = useTranslation();
  const lang: "en" | "ar" = language === "ar" ? "ar" : "en";
  const t = faqCopy(lang);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<FaqCategory>("all");

  const normalizedSearch = searchTerm.trim().toLocaleLowerCase(lang);
  const filteredFaqs = t.items.filter((item) => {
    const matchesCategory =
      selectedCategory === "all" || item.category === selectedCategory;
    if (!matchesCategory) return false;
    if (!normalizedSearch) return true;
    return `${item.question} ${item.answer} ${t.categories[item.category]}`
      .toLocaleLowerCase(lang)
      .includes(normalizedSearch);
  });

  return (
    <main dir={isRTL ? "rtl" : "ltr"} className="bg-background text-foreground">
      <SeoHead
        title={t.seoTitle}
        description={t.seoDescription}
        canonicalPath="/faq"
      />

      <section className="border-b border-border/60 bg-gradient-to-b from-warm-gold/10 to-transparent">
        <div className="container mx-auto max-w-4xl px-4 py-12 text-center sm:py-16">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t.title}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">
            {t.subtitle}
          </p>
        </div>
      </section>

      <div className="container mx-auto max-w-4xl px-4 py-10">
        <section aria-labelledby="faq-filter-title">
          <h2 id="faq-filter-title" className="sr-only">{t.filterTitle}</h2>
          <label htmlFor="faq-search" className="sr-only">{t.searchLabel}</label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="faq-search"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t.searchPlaceholder}
              className="min-h-[44px] ps-10"
              autoComplete="off"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2" aria-label={t.categoryLabel}>
            {(Object.keys(t.categories) as FaqCategory[]).map((category) => (
              <Button
                key={category}
                type="button"
                size="sm"
                variant={selectedCategory === category ? "default" : "outline"}
                className="min-h-[44px] min-w-[44px]"
                aria-pressed={selectedCategory === category}
                onClick={() => setSelectedCategory(category)}
              >
                {t.categories[category]}
              </Button>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border bg-card p-4 sm:p-6" aria-labelledby="faq-results-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="faq-results-title" className="text-xl font-semibold">
              {t.categories[selectedCategory]}
            </h2>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {t.resultCount(filteredFaqs.length)}
            </p>
          </div>

          {filteredFaqs.length > 0 ? (
            <Accordion type="single" collapsible className="mt-4 w-full">
              {filteredFaqs.map((item) => (
                <AccordionItem key={item.id} value={item.id}>
                  <AccordionTrigger className="min-h-[44px] text-start hover:no-underline">
                    <span className="flex min-w-0 items-start gap-2">
                      <Badge variant="outline" className="mt-0.5 shrink-0">
                        {t.categories[item.category]}
                      </Badge>
                      <span>{item.question}</span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <p className="py-10 text-center text-muted-foreground">{t.empty}</p>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-warm-gold/40 bg-warm-gold/5 p-6 text-center">
          <h2 className="text-xl font-semibold">{t.helpTitle}</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
            {t.helpDescription}
          </p>
          <Button asChild className="mt-5 min-h-[44px] bg-warm-gold text-dark-base hover:bg-warm-gold/90">
            <Link to="/contact">{t.contact}</Link>
          </Button>
        </section>
      </div>
    </main>
  );
}

function faqCopy(lang: "en" | "ar"): {
  seoTitle: string;
  seoDescription: string;
  title: string;
  subtitle: string;
  filterTitle: string;
  searchLabel: string;
  searchPlaceholder: string;
  categoryLabel: string;
  categories: Record<FaqCategory, string>;
  items: FaqItem[];
  resultCount: (count: number) => string;
  empty: string;
  helpTitle: string;
  helpDescription: string;
  contact: string;
} {
  if (lang === "ar") {
    return {
      seoTitle: "الأسئلة الشائعة · JojoPrompts",
      seoDescription:
        "إجابات واضحة عن المهارات والأتمتة والبرومبتات، الدفع لمرة واحدة، المكتبة الدائمة، التنزيلات، والاسترداد.",
      title: "الأسئلة الشائعة",
      subtitle:
        "كل ما تحتاج معرفته عن موارد JojoPrompts V2، الملكية الدائمة، والدفع لمرة واحدة.",
      filterTitle: "ابحث وصفِّ الأسئلة",
      searchLabel: "ابحث في الأسئلة الشائعة",
      searchPlaceholder: "ابحث عن سؤال…",
      categoryLabel: "فئات الأسئلة",
      categories: {
        all: "الكل",
        getting_started: "البدء",
        ownership: "الملكية",
        resources: "الموارد",
        payments: "الدفع",
        safety: "الأمان والتنزيل",
      },
      items: [
        {
          id: "browse-account",
          category: "getting_started",
          question: "هل أحتاج إلى حساب لتصفّح الموارد؟",
          answer:
            "لا. التصفّح والبحث وصفحات التفاصيل متاحة للجميع. تحتاج إلى تسجيل الدخول فقط للحصول على مورد مجاني أو شراء مورد أو تنزيله أو إضافته إلى مكتبتك.",
        },
        {
          id: "resource-types",
          category: "resources",
          question: "ما أنواع الموارد المتاحة؟",
          answer:
            "يضم الكتالوج مهارات، أتمتة وسِيَر عمل، برومبتات فردية، حزم برومبتات منظّمة، أنماط صور، وحزم موارد.",
        },
        {
          id: "install-skill",
          category: "resources",
          question: "كيف أثبّت مهارة أو أتمتة؟",
          answer:
            "افتح صفحة المورد واتبع دليل التثبيت الخاص بمنصّتك. الصفحة تعرض الملفات، الاعتماديات، الأذونات، الخدمات الخارجية، الأسرار المطلوبة، القيود، وطريقة الإزالة عندما تنطبق.",
        },
        {
          id: "platforms",
          category: "resources",
          question: "ما المنصّات المدعومة؟",
          answer:
            "نبدأ بدعم Claude وChatGPT وCodex وGemini وHermes وKimi، إضافة إلى خيار عام أو يدوي. كل مورد يذكر توافقه الفعلي؛ لا نفترض أن كل مورد يعمل على كل منصّة.",
        },
        {
          id: "one-time",
          category: "ownership",
          question: "هل توجد اشتراكات أو رسوم متكررة؟",
          answer:
            "لا. JojoPrompts V2 يعتمد الدفع لمرة واحدة فقط. الموارد المجانية والمدفوعة التي تحصل عليها تُضاف كاستحقاق دائم إلى مكتبتك.",
        },
        {
          id: "lifetime-credit",
          category: "ownership",
          question: "كيف يعمل رصيد المكتبة الكاملة مدى الحياة؟",
          answer:
            "المبلغ المدفوع فعلياً في مشتريات جوجو المؤهلة يُحتسب نحو حدّ 30.000 د.ك. عند بلوغ الحد تحصل تلقائياً على استحقاق مكتبة جوجو الكاملة مدى الحياة، ويمكنك أيضاً دفع الرصيد المتبقي مباشرة.",
        },
        {
          id: "legacy-access",
          category: "ownership",
          question: "ماذا يحدث لحقوق العملاء السابقين؟",
          answer:
            "نحافظ على الحقوق الصحيحة المسجلة سابقاً. الوصول السابق مدى الحياة يتحول إلى الاستحقاق المقابل، والوصول الخاص بمنصّة يتحول إلى مجموعة مطابقة مع الحفاظ على أي انتهاء أصلي إن وُجد.",
        },
        {
          id: "updates",
          category: "ownership",
          question: "هل يشمل الشراء التحديثات؟",
          answer:
            "الشراء الفردي يشمل الإصدار الرئيسي الحالي والإصلاحات والتحديثات الفرعية المنطبقة عليه. صفحة المورد ومكتبتك تعرضان الإصدار وسجل التغييرات والتحديثات المتاحة.",
        },
        {
          id: "payment-methods",
          category: "payments",
          question: "ما طرق الدفع المتاحة؟",
          answer:
            "تُعالج الدفعات لمرة واحدة عبر UPayments بالدينار الكويتي. قد تظهر KNET وVisa وMastercard وApple Pay بحسب الجهاز والبطاقة وإعدادات بوابة الدفع.",
        },
        {
          id: "payment-recovery",
          category: "payments",
          question: "ماذا أفعل إذا دفعت ولم يظهر المورد؟",
          answer:
            "افتح طلباتك أولاً لأن التحقق قد يحتاج لحظات. إذا بقي الطلب معلقاً، استخدم الاسترداد الآمن أو تواصل معنا برقم الطلب. لا تنشئ دفعة ثانية قبل التحقق من الأولى.",
        },
        {
          id: "refunds",
          category: "payments",
          question: "كيف أطلب استرداداً؟",
          answer:
            "تواصل معنا برقم الطلب وسبب الطلب. تُراجع الأهلية بحسب حالة الدفع والتسليم والوصول والقانون المنطبق. إذا تم الاسترداد، يُعكس الاستحقاق ورصيد مدى الحياة المرتبط بالمبلغ المسترد.",
        },
        {
          id: "scan-download",
          category: "safety",
          question: "كيف أعرف أن ملف التنزيل آمن؟",
          answer:
            "صفحة المورد تعرض حالة فحص الحزمة والإصدار والحجم وبصمة SHA-256 عند توفر ملف. لا تُحمّل حزمة لم تجتز حالة الثقة المطلوبة، وراجع الأذونات والاعتماديات قبل التثبيت.",
        },
        {
          id: "license",
          category: "ownership",
          question: "هل يمكنني استخدام النتائج تجارياً أو مشاركة الملفات؟",
          answer:
            "يسمح ترخيص جوجو القياسي باستخدام المورد شخصياً واستخدام مخرجاته تجارياً، ما لم تذكر صفحة المورد خلاف ذلك. لا يجوز إعادة توزيع ملفات المورد الأساسية أو إعادة بيعها أو مشاركتها كمادة قابلة للتنزيل.",
        },
        {
          id: "creators",
          category: "getting_started",
          question: "هل يمكن للمبدعين رفع مواردهم وبيعها الآن؟",
          answer:
            "ليس في V2.0. الكتالوج الحالي مملوك لجوجو وتديره جوجو فقط. مساهمات المبدعين وسوق المبدعين المدفوع والعمولات والمدفوعات مؤجلة لإصدارات لاحقة.",
        },
      ],
      resultCount: (count) => `${count} سؤال`,
      empty: "لم نجد سؤالاً يطابق بحثك.",
      helpTitle: "ما زلت تحتاج إلى مساعدة؟",
      helpDescription:
        "أرسل لنا تفاصيل المشكلة ورقم الطلب إن كان السؤال متعلقاً بعملية شراء.",
      contact: "تواصل مع الدعم",
    };
  }

  return {
    seoTitle: "Frequently asked questions · JojoPrompts",
    seoDescription:
      "Clear answers about skills, automations, prompts, one-time payments, permanent ownership, downloads, and refunds.",
    title: "Frequently asked questions",
    subtitle:
      "Everything you need to know about JojoPrompts V2 resources, permanent ownership, and one-time payments.",
    filterTitle: "Search and filter questions",
    searchLabel: "Search frequently asked questions",
    searchPlaceholder: "Search questions…",
    categoryLabel: "Question categories",
    categories: {
      all: "All",
      getting_started: "Getting started",
      ownership: "Ownership",
      resources: "Resources",
      payments: "Payments",
      safety: "Safety & downloads",
    },
    items: [
      {
        id: "browse-account",
        category: "getting_started",
        question: "Do I need an account to browse resources?",
        answer:
          "No. Browsing, search, and resource detail pages are public. Sign-in is required only to acquire a free resource, buy, download, or add something to your library.",
      },
      {
        id: "resource-types",
        category: "resources",
        question: "What resource types are available?",
        answer:
          "The catalog contains skills, automations and workflows, individual prompts, structured prompt packs, image styles, and resource bundles.",
      },
      {
        id: "install-skill",
        category: "resources",
        question: "How do I install a skill or automation?",
        answer:
          "Open the resource page and follow the guide for your platform. It lists files, dependencies, permissions, external services, required secrets, limitations, and uninstall guidance when applicable.",
      },
      {
        id: "platforms",
        category: "resources",
        question: "Which platforms are supported?",
        answer:
          "Initial platforms are Claude, ChatGPT, Codex, Gemini, Hermes, Kimi, and Generic/manual. Every resource declares its actual compatibility; we do not assume every resource works everywhere.",
      },
      {
        id: "one-time",
        category: "ownership",
        question: "Are there subscriptions or recurring charges?",
        answer:
          "No. JojoPrompts V2 uses one-time payments only. Free and paid resources you acquire become permanent entitlements in your library.",
      },
      {
        id: "lifetime-credit",
        category: "ownership",
        question: "How does Full Library Lifetime credit work?",
        answer:
          "The amount actually paid for eligible Jojo purchases counts toward the 30.000 KD threshold. Crossing it automatically grants Jojo Full Library Lifetime, and you may also pay the remaining balance directly.",
      },
      {
        id: "legacy-access",
        category: "ownership",
        question: "What happens to previous customer access?",
        answer:
          "Valid historical rights are preserved. Previous lifetime access becomes the matching lifetime entitlement, while platform-specific access becomes a matching collection entitlement with any original expiry preserved.",
      },
      {
        id: "updates",
        category: "ownership",
        question: "Does my purchase include updates?",
        answer:
          "An individual purchase includes the current major version and applicable fixes or minor updates. The resource page and your library show versions, changelogs, and available updates.",
      },
      {
        id: "payment-methods",
        category: "payments",
        question: "Which payment methods are available?",
        answer:
          "One-time payments are processed through UPayments in Kuwaiti dinars. KNET, Visa, Mastercard, and Apple Pay may appear depending on the device, card, and payment-gateway configuration.",
      },
      {
        id: "payment-recovery",
        category: "payments",
        question: "What should I do if I paid but the resource is missing?",
        answer:
          "Check Orders first because verification can take a moment. If it stays pending, use the safe recovery flow or contact us with the order number. Do not create a second payment until the first is checked.",
      },
      {
        id: "refunds",
        category: "payments",
        question: "How do I request a refund?",
        answer:
          "Contact us with the order number and reason. Eligibility is reviewed against payment, delivery, access state, and applicable law. An approved refund reverses the related entitlement and lifetime credit.",
      },
      {
        id: "scan-download",
        category: "safety",
        question: "How can I check whether a download is safe?",
        answer:
          "The resource page shows package scan state, version, size, and SHA-256 checksum when a file exists. Do not install a package that has not reached the required trust state, and review permissions and dependencies first.",
      },
      {
        id: "license",
        category: "ownership",
        question: "Can I use outputs commercially or share the files?",
        answer:
          "The standard Jojo license permits personal use and commercial use of outputs unless the resource page says otherwise. You may not redistribute, resell, or share the underlying resource files as downloadable material.",
      },
      {
        id: "creators",
        category: "getting_started",
        question: "Can creators upload and sell resources now?",
        answer:
          "Not in V2.0. Today’s catalog is Jojo-owned and Jojo-operated. Creator contributions, marketplace commissions, and payouts are reserved for later releases.",
      },
    ],
    resultCount: (count) => `${count} question${count === 1 ? "" : "s"}`,
    empty: "No questions match your search.",
    helpTitle: "Still need help?",
    helpDescription:
      "Send us the details and include your order number when the question relates to a purchase.",
    contact: "Contact support",
  };
}
