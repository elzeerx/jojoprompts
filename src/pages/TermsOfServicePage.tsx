import { LegalDocumentPage, type LegalSection } from "@/pages/v2/LegalDocumentPage";
import { useTranslation } from "@/hooks/useTranslation";

export default function TermsOfServicePage() {
  const { language, isRTL } = useTranslation();
  const lang: "en" | "ar" = language === "ar" ? "ar" : "en";
  const t = termsCopy(lang);

  return (
    <LegalDocumentPage
      dir={isRTL ? "rtl" : "ltr"}
      seoTitle={t.seoTitle}
      seoDescription={t.seoDescription}
      canonicalPath="/terms"
      title={t.title}
      updatedLabel={t.updatedLabel}
      intro={t.intro}
      sections={t.sections}
      contactTitle={t.contactTitle}
      contactDescription={t.contactDescription}
    />
  );
}

function termsCopy(lang: "en" | "ar"): {
  seoTitle: string;
  seoDescription: string;
  title: string;
  updatedLabel: string;
  intro: string;
  sections: LegalSection[];
  contactTitle: string;
  contactDescription: string;
} {
  if (lang === "ar") {
    return {
      seoTitle: "شروط الاستخدام · JojoPrompts",
      seoDescription:
        "شروط JojoPrompts V2 للموارد والدفع لمرة واحدة والاستحقاقات الدائمة والمكتبة الكاملة والتنزيل والترخيص والاسترداد.",
      title: "شروط الاستخدام",
      updatedLabel: "آخر تحديث: 28 يوليو 2026",
      intro:
        "تنظم هذه الشروط استخدام JojoPrompts V2 وشراء موارد جوجو الرقمية. تعتمد V2.0 الدفع لمرة واحدة فقط ولا تقدم اشتراكات أو سوق مبدعين. باستخدام الموقع أو إتمام عملية شراء، فإنك توافق على هذه الشروط وسياسة الخصوصية وأي شروط خاصة ظاهرة في صفحة المورد أو عند الدفع.",
      sections: [
        {
          title: "الأهلية والحساب",
          bullets: [
            "يجب أن تملك الأهلية القانونية لاستخدام الخدمة وإبرام عملية شراء في بلدك.",
            "أنت مسؤول عن دقة بيانات الحساب وحماية كلمة المرور والجلسات المرتبطة به.",
            "لا يجوز مشاركة الحساب بطريقة تتحايل على الترخيص أو تتيح تنزيل الموارد لأشخاص غير مخولين.",
            "قد نطلب التحقق من البريد أو الهوية أو المعاملة لحماية الحساب وحل مشكلة دفع أو استرداد.",
          ],
        },
        {
          title: "الخدمة ونطاق V2.0",
          paragraphs: [
            "يمكن للجميع تصفّح الكتالوج وصفحات التفاصيل. يلزم تسجيل الدخول للحصول على مورد مجاني أو شراء أو تنزيل أو حفظ مورد والوصول إلى المكتبة والطلبات.",
            "تضم V2.0 مهارات وأتمتة وسِيَر عمل وبرومبتات وحزم برومبتات وأنماط صور وحزم موارد مملوكة لجوجو وتديرها جوجو. مساهمات المبدعين وسوقهم وعمولاتهم ومدفوعاتهم ليست جزءاً من V2.0.",
          ],
        },
        {
          title: "الأسعار والدفع",
          paragraphs: [
            "الدينار الكويتي هو العملة المعتمدة، وتُخزّن المبالغ كفلس صحيح. السعر الظاهر عند إنشاء الطلب من خادم JojoPrompts هو السعر الموثوق لتلك المعاملة.",
            "تُعالج الدفعات لمرة واحدة عبر UPayments. قد تتيح البوابة KNET وVisa وMastercard وApple Pay بحسب الجهاز والبطاقة والإعدادات. لا يقدم JojoPrompts رسوماً دورية أو تجديداً تلقائياً.",
            "يصبح الطلب مدفوعاً ولا يُمنح الاستحقاق إلا بعد مطابقة حالة المزود والمبلغ والعملة والعميل ومرجع الطلب. لا تعتمد صفحة العودة وحدها كإثبات دفع.",
          ],
        },
        {
          title: "الملكية والاستحقاقات الدائمة",
          bullets: [
            "المورد المجاني أو المدفوع الذي تحصل عليه بشكل صحيح يمنح حسابك استحقاقاً دائماً، ما لم يُسترد المورد أو تُلغَ المعاملة بسبب خطأ أو احتيال مثبت.",
            "لا يمكنك شراء مورد تملكه بالفعل، وقد تُزال العناصر المملوكة من السلة تلقائياً.",
            "شراء مورد فردي يشمل الإصدار الرئيسي الحالي والإصلاحات والتحديثات الفرعية المنطبقة، ما لم تذكر صفحة المورد نطاقاً أوسع.",
            "الحزمة تمنح ما توضحه صفحة الحزمة وقت الشراء. الإضافات المستقبلية ليست مضمونة إلا إذا نُص عليها.",
          ],
        },
        {
          title: "المكتبة الكاملة مدى الحياة",
          paragraphs: [
            "سعر مكتبة جوجو الكاملة مدى الحياة هو 30.000 د.ك. وهي تشمل موارد جوجو الحالية والمستقبلية وميزات جوجو المشمولة، ولا تشمل تلقائياً منتجات مبدعين مستقلين مستقبلية.",
            "تُحتسب المشتريات المؤهلة والمسددة وغير المستردة بالقيمة المدفوعة فعلياً نحو الحد. يؤدي بلوغ 30.000 د.ك إلى منح الاستحقاق تلقائياً، ويمكنك دفع الرصيد المتبقي مباشرة.",
            "الخصومات تحتسب بالقيمة المدفوعة. الاسترداد يعكس الرصيد المرتبط به، وقد يُلغى استحقاق مدى الحياة الناتج عن بلوغ الحد إذا انخفض الإجمالي دونه. تبقى الموارد الفردية الأخرى مملوكة ما لم تُسترد هي نفسها.",
          ],
        },
        {
          title: "حقوق العملاء السابقين",
          paragraphs: [
            "نحافظ على حقوق الوصول الصحيحة المسجلة قبل V2. الوصول السابق مدى الحياة يتحول إلى الاستحقاق المقابل، والوصول الخاص بمنصّة يتحول إلى مجموعة مطابقة مع الحفاظ على أي انتهاء أصلي.",
            "تُحفظ سجلات المعاملات السابقة وتواريخها وعملاتها ومزودها. معالجة الرصيد التاريخي أو تحويل العملة لأغراض الترحيل لا يغيّر السجل الأصلي.",
          ],
        },
        {
          title: "الترخيص والاستخدام المسموح",
          paragraphs: [
            "ما لم تذكر صفحة المورد خلاف ذلك، يسمح ترخيص جوجو القياسي باستخدام المورد شخصياً واستخدام المخرجات الناتجة عنه تجارياً.",
            "لا يجوز إعادة توزيع ملف المورد الأساسي أو الحزمة أو البرومبت أو التعليمات كمنتج قابل للتنزيل، ولا إعادة بيعها أو نشرها أو منحها للغير أو استخدامها لبناء مكتبة منافسة.",
            "لا تنتقل إليك ملكية حقوق JojoPrompts أو تصميم الموقع أو قاعدة البيانات أو العلامات. تحتفظ بحقوق المخرجات التي يمنحها لك القانون وشروط منصة الذكاء الاصطناعي المستخدمة.",
          ],
        },
        {
          title: "التوافق والأذونات والخدمات الخارجية",
          paragraphs: [
            "توضح صفحة المورد المنصّات والإصدارات والاعتماديات والأذونات والخدمات الخارجية والأسرار المعروفة. يجب أن تراجع هذه المعلومات قبل التثبيت وأن تحمي مفاتيح API وبيانات الاعتماد الخاصة بك.",
            "منصّات مثل Claude وChatGPT وCodex وGemini وHermes وKimi وخدمات الأتمتة جهات مستقلة؛ يخضع استخدامها لشروطها وقد تغيّر واجهاتها أو قدراتها. لا نضمن استمرار توافق طرف ثالث إلى الأبد.",
            "لا تُثبّت حزمة لا تثق بحالتها أو أذوناتها. حالة الفحص تقلل المخاطر ولا تضمن غياب كل مشكلة.",
          ],
        },
        {
          title: "التنزيل والتحديثات والتوفر",
          paragraphs: [
            "التنزيلات محمية باستحقاق وروابط موقّعة تنتهي صلاحيتها. انتهاء الرابط لا يعني انتهاء ملكيتك؛ يمكنك طلب رابط جديد من مكتبتك ما دام الاستحقاق صالحاً.",
            "نحاول المحافظة على الملفات والتعليمات والإصدارات، لكن قد نصلح مورداً أو نستبدل ملفاً ضاراً أو نوقف إصداراً غير آمن. لا نستبدل ملفات الإصدارات السابقة بطريقة تلغي سجل الشراء.",
          ],
        },
        {
          title: "الاسترداد والنزاعات",
          paragraphs: [
            "لطلب استرداد، تواصل معنا برقم الطلب وسبب الطلب. تُراجع الأهلية بحسب حالة الدفع والتسليم والوصول وطبيعة المورد والقانون المنطبق. لا توجد في هذه الشروط ضمانة استرداد عامة لمدة 30 يوماً.",
            "إذا تمت الموافقة على الاسترداد، يُعكس الاستحقاق ورصيد المكتبة الكاملة المتعلق بالمبلغ المسترد. الاسترداد الجزئي يؤثر فقط في البنود والقيم المحددة.",
            "إذا ظهر دفع مكرر أو غير معروف، تواصل معنا قبل إنشاء دفعة إضافية أو فتح نزاع حتى نتمكن من مطابقة سجل المزود والطلب.",
          ],
        },
        {
          title: "الاستخدام المحظور",
          bullets: [
            "محاولة تجاوز تسجيل الدخول أو الاستحقاق أو روابط التنزيل أو سياسات التخزين.",
            "إعادة توزيع الموارد أو بيعها أو كشط الكتالوج أو نسخ قاعدة البيانات آلياً.",
            "رفع أو إرسال برمجيات ضارة أو أسرار أو محتوى ينتهك حقوق الآخرين أو القانون.",
            "التدخل في الدفع أو الاسترداد أو سجلات التدقيق أو محاولة انتحال معاملة أو مستخدم.",
            "استخدام الخدمة لإساءة أو احتيال أو نشاط غير قانوني أو مخالف لشروط منصة الطرف الثالث.",
          ],
        },
        {
          title: "التعليق والإنهاء",
          paragraphs: [
            "قد نقيّد أو نعلّق حساباً لحماية المستخدمين أو التحقيق في احتيال أو نزاع دفع أو خرق جوهري لهذه الشروط. سنحافظ على الحقوق الصحيحة حيثما أمكن وبما لا يتعارض مع القانون أو متطلبات الأمان.",
            "إغلاق الحساب لا يلغي الالتزامات السابقة، وقد يؤثر في قدرتك على الوصول إلى الموارد المرتبطة به. تواصل معنا قبل الإغلاق إذا كان الحساب يحتوي على مشتريات.",
          ],
        },
        {
          title: "إخلاء المسؤولية وحدودها",
          paragraphs: [
            "تُقدّم الموارد الرقمية بحسب الوصف المتاح. قد تختلف النتائج باختلاف النموذج والإصدار والبيانات والسياق وإعدادات المستخدم. أنت مسؤول عن مراجعة المخرجات قبل الاعتماد عليها في قرارات مهمة.",
            "لا تشكل الموارد نصيحة طبية أو قانونية أو مالية أو مهنية، ولا نضمن نتيجة محددة أو توافقاً دائماً مع خدمة خارجية. تُطبق أي ضمانات أو حدود مسؤولية بالقدر الذي يسمح به القانون المنطبق، ولا تحد هذه الشروط من حقوق المستهلك الإلزامية.",
          ],
        },
        {
          title: "التغييرات والقانون المنطبق",
          paragraphs: [
            "قد نحدّث الخدمة أو هذه الشروط لتوضيح المنتجات أو الدفع أو الأمان أو المتطلبات القانونية. يظهر تاريخ آخر تحديث أعلى الصفحة، وتُعرض التغييرات الجوهرية بالطريقة المناسبة.",
            "تخضع المعاملة للقوانين الإلزامية التي تنطبق على العميل وتشغيل JojoPrompts. لا تمنع هذه الشروط أي حق لا يمكن التنازل عنه قانوناً.",
          ],
        },
      ],
      contactTitle: "الأسئلة والشكاوى",
      contactDescription:
        "للسؤال عن هذه الشروط أو تقديم شكوى أو طلب استرداد، أرسل رقم الطلب والتفاصيل اللازمة فقط ولا ترسل بيانات بطاقة أو أسراراً.",
    };
  }

  return {
    seoTitle: "Terms of service · JojoPrompts",
    seoDescription:
      "JojoPrompts V2 terms for resources, one-time payments, permanent entitlements, Full Library Lifetime, downloads, licensing, and refunds.",
    title: "Terms of service",
    updatedLabel: "Last updated: 28 July 2026",
    intro:
      "These terms govern JojoPrompts V2 and purchases of Jojo digital resources. V2.0 uses one-time payments only and does not offer subscriptions or a creator marketplace. By using the site or completing a purchase, you agree to these terms, the Privacy Policy, and any resource-specific terms shown on the detail or checkout page.",
    sections: [
      {
        title: "Eligibility and accounts",
        bullets: [
          "You must have legal capacity to use the service and make a purchase in your country.",
          "You are responsible for accurate account information and for protecting your password and sessions.",
          "You may not share an account to bypass licensing or provide downloads to unauthorized people.",
          "We may verify an email, identity, or transaction to protect an account or resolve a payment or refund issue.",
        ],
      },
      {
        title: "Service and V2.0 scope",
        paragraphs: [
          "Anyone may browse the catalog and detail pages. Sign-in is required to acquire a free resource, buy, download, save, or access the library and orders.",
          "V2.0 contains Jojo-owned and Jojo-operated skills, automations and workflows, prompts, prompt packs, image styles, and bundles. Creator contributions, marketplace commissions, and payouts are not part of V2.0.",
        ],
      },
      {
        title: "Prices and payment",
        paragraphs: [
          "Kuwaiti dinar is the authoritative currency and amounts are stored as integer fils. The price supplied by the JojoPrompts server when an order is created is authoritative for that transaction.",
          "One-time payments are processed through UPayments. KNET, Visa, Mastercard, and Apple Pay may be available depending on device, card, and configuration. JojoPrompts does not charge recurring fees or automatically renew purchases.",
          "An order is treated as paid and entitlement is granted only after provider state, amount, currency, customer, and order reference reconcile. A return-page message alone is not proof of payment.",
        ],
      },
      {
        title: "Ownership and permanent entitlements",
        bullets: [
          "A properly acquired free or paid resource grants a permanent account entitlement unless that resource is refunded or the transaction is reversed for proven error or fraud.",
          "You cannot buy an already-owned resource, and owned items may be removed from the cart automatically.",
          "An individual purchase includes the current major version and applicable fixes or minor updates unless the resource page states broader coverage.",
          "A bundle grants what its page identifies at purchase time. Future additions are not guaranteed unless expressly included.",
        ],
      },
      {
        title: "Full Library Lifetime",
        paragraphs: [
          "Jojo Full Library Lifetime costs 30.000 KD. It includes current and future Jojo resources and included Jojo features, but does not automatically include future independent-creator products.",
          "Eligible settled, non-refunded purchases count using the amount actually paid. Reaching 30.000 KD grants lifetime automatically, and you may pay the remaining balance directly.",
          "Discounts count at the paid value. A refund reverses related credit and may revoke a threshold-derived lifetime entitlement if the settled total falls below the threshold. Other individual resources remain owned unless they are themselves refunded.",
        ],
      },
      {
        title: "Previous customer rights",
        paragraphs: [
          "Valid access recorded before V2 is preserved. Previous lifetime access becomes the matching lifetime entitlement, while platform-specific access becomes a matching collection entitlement with any original expiry preserved.",
          "Historical transaction provider, date, currency, and amount records remain intact. Migration credit or currency conversion does not rewrite the original transaction record.",
        ],
      },
      {
        title: "License and permitted use",
        paragraphs: [
          "Unless a resource page states otherwise, the standard Jojo license permits personal use of the resource and commercial use of outputs created with it.",
          "You may not redistribute, resell, publish, share, or sublicense the underlying resource file, package, prompt, or instructions as downloadable material or use them to build a competing library.",
          "Ownership of JojoPrompts branding, site design, database, and underlying resource rights does not transfer. Rights in outputs also depend on applicable law and the terms of the AI platform you use.",
        ],
      },
      {
        title: "Compatibility, permissions, and external services",
        paragraphs: [
          "Resource pages identify known platforms, versions, dependencies, permissions, external services, and secrets. Review them before installation and protect your own API keys and credentials.",
          "Claude, ChatGPT, Codex, Gemini, Hermes, Kimi, and automation providers are independent services with their own terms and changing interfaces. Permanent third-party compatibility cannot be guaranteed.",
          "Do not install a package whose trust state or permissions you do not accept. A clean scan reduces risk but cannot guarantee that every issue is absent.",
        ],
      },
      {
        title: "Downloads, updates, and availability",
        paragraphs: [
          "Downloads require entitlement and use expiring signed links. Link expiry does not end ownership; you may request a fresh link from your library while the entitlement remains valid.",
          "We work to preserve files, guides, and versions, but may repair a resource, replace a malicious file, or retire an unsafe version. Prior-version records are not overwritten in a way that erases purchase history.",
        ],
      },
      {
        title: "Refunds and disputes",
        paragraphs: [
          "To request a refund, contact us with the order number and reason. Eligibility is reviewed against payment, delivery, access, resource nature, and applicable law. These terms do not promise a general 30-day money-back guarantee.",
          "An approved refund reverses the related entitlement and Full Library credit. A partial refund affects only the specified items and value.",
          "For a duplicate or unrecognized payment, contact us before paying again or opening a dispute so the provider and order records can be reconciled.",
        ],
      },
      {
        title: "Prohibited use",
        bullets: [
          "Bypassing sign-in, entitlement, download-link, or storage controls.",
          "Redistributing or reselling resources, scraping the catalog, or copying the database automatically.",
          "Submitting malware, secrets, unlawful content, or material that infringes another person’s rights.",
          "Interfering with payment, refund, or audit records or impersonating a transaction or user.",
          "Using the service for abuse, fraud, illegal activity, or violation of a third-party platform’s terms.",
        ],
      },
      {
        title: "Suspension and termination",
        paragraphs: [
          "We may restrict or suspend an account to protect users or investigate fraud, a payment dispute, or a material terms violation. Valid rights will be preserved where possible and consistent with law and security.",
          "Closing an account does not remove prior obligations and may affect access to resources attached to it. Contact us before closure when the account contains purchases.",
        ],
      },
      {
        title: "Disclaimers and limits",
        paragraphs: [
          "Digital resources are provided according to their available description. Results vary by model, version, data, context, and user settings. You are responsible for reviewing outputs before relying on them for important decisions.",
          "Resources are not medical, legal, financial, or professional advice, and no particular result or permanent third-party compatibility is guaranteed. Any warranty or liability limitation applies only as far as applicable law permits and does not remove mandatory consumer rights.",
        ],
      },
      {
        title: "Changes and applicable law",
        paragraphs: [
          "We may update the service or these terms to reflect products, payment, security, or legal requirements. The revision date appears above and material changes will be presented appropriately.",
          "Mandatory laws applicable to the customer and JojoPrompts operation govern the transaction. These terms do not waive any right that cannot legally be waived.",
        ],
      },
    ],
    contactTitle: "Questions and complaints",
    contactDescription:
      "For a terms question, complaint, or refund request, send the order number and necessary details only. Never send card data or secrets.",
  };
}
