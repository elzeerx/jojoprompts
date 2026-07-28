import { LegalDocumentPage, type LegalSection } from "@/pages/v2/LegalDocumentPage";
import { useTranslation } from "@/hooks/useTranslation";

export default function PrivacyPolicyPage() {
  const { language, isRTL } = useTranslation();
  const lang: "en" | "ar" = language === "ar" ? "ar" : "en";
  const t = privacyCopy(lang);

  return (
    <LegalDocumentPage
      dir={isRTL ? "rtl" : "ltr"}
      seoTitle={t.seoTitle}
      seoDescription={t.seoDescription}
      canonicalPath="/privacy"
      title={t.title}
      updatedLabel={t.updatedLabel}
      intro={t.intro}
      sections={t.sections}
      contactTitle={t.contactTitle}
      contactDescription={t.contactDescription}
    />
  );
}

function privacyCopy(lang: "en" | "ar"): {
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
      seoTitle: "سياسة الخصوصية · JojoPrompts",
      seoDescription:
        "كيف يجمع JojoPrompts بيانات الحساب والطلبات والدفع والتنزيل والدعم ويستخدمها ويحميها في تجربة V2.",
      title: "سياسة الخصوصية",
      updatedLabel: "آخر تحديث: 28 يوليو 2026",
      intro:
        "توضح هذه السياسة كيفية تعامل JojoPrompts مع المعلومات عند تصفّح الموقع أو إنشاء حساب أو الحصول على مورد أو الدفع أو التنزيل أو التواصل مع الدعم. لا تتضمن V2.0 رفع موارد من المبدعين أو ملفات عملاء إلى السوق.",
      sections: [
        {
          title: "المعلومات التي نجمعها",
          bullets: [
            "بيانات الحساب والملف الشخصي مثل الاسم والبريد الإلكتروني ومعرّف المستخدم وإعداد اللغة.",
            "بيانات الطلب والاستحقاق مثل المنتجات والمبالغ بالدينار الكويتي وحالة الطلب والخصم والاسترداد ورصيد المكتبة الكاملة.",
            "معرّفات الدفع وحالة المعاملة ووقت التسوية ووسيلة الدفع التي تعيدها بوابة الدفع.",
            "سجل التنزيل والإصدار والترخيص عندما يكون ضرورياً لتسليم المورد وحماية الاستحقاق.",
            "رسائل الدعم وبيانات الاتصال التي ترسلها طوعاً.",
            "بيانات تشغيل وأمان محدودة مثل نوع المتصفح والصفحات وأحداث الخطأ ومحاولات الدخول أو حدود المعدل وعناوين الشبكة عند الحاجة للحماية.",
          ],
        },
        {
          title: "الدفع وبيانات البطاقة",
          paragraphs: [
            "تُعالج الدفعات لمرة واحدة عبر UPayments. قد تتيح البوابة KNET وVisa وMastercard وApple Pay بحسب الجهاز والبطاقة والإعدادات.",
            "لا نخزّن رقم البطاقة الكامل أو رمز الأمان أو بيانات اعتماد KNET. نخزّن فقط البيانات اللازمة للمطابقة والمحاسبة ومنح الاستحقاق، مثل معرّف المعاملة والمبلغ والعملة والنتيجة وحالة الاسترداد.",
          ],
        },
        {
          title: "كيف نستخدم المعلومات",
          bullets: [
            "إنشاء الحساب وتسجيل الدخول وإدارة الملف الشخصي.",
            "إنشاء الطلبات والتحقق من الدفع ومنح الاستحقاقات الدائمة ومنع الشراء المكرر.",
            "حساب رصيد المكتبة الكاملة مدى الحياة ومعالجة الاسترداد وعكس الرصيد المرتبط به.",
            "تفويض روابط التنزيل الموقّعة وعرض الإصدارات والتراخيص والإيصالات.",
            "إرسال رسائل المعاملات والأمان والدعم، بما فيها إيصالات الطلب.",
            "اكتشاف الاحتيال وسوء الاستخدام والمشكلات الفنية وتحسين الأداء وسهولة الاستخدام.",
            "الامتثال للالتزامات القانونية والمحاسبية وحماية حقوق المستخدمين والمنصة.",
          ],
        },
        {
          title: "مقدمو الخدمات",
          paragraphs: [
            "نستخدم Supabase للمصادقة وقاعدة البيانات والتخزين والوظائف الخلفية، وUPayments لمعالجة الدفع، وResend لإرسال البريد الإلكتروني، وCloudmersive لفحص حزم كتالوج جوجو بحثاً عن برمجيات ضارة. قد نستخدم أيضاً خدمات الاستضافة والمراقبة والتحليلات التشغيلية اللازمة لتشغيل الموقع.",
            "يحصل كل مقدم خدمة على البيانات اللازمة لأداء مهمته فقط ويعالجها وفق شروطه وضوابطه. لا نبيع معلوماتك الشخصية.",
          ],
        },
        {
          title: "ملفات الحزم وفحص الأمان",
          paragraphs: [
            "حزم الموارد التي ترفعها إدارة جوجو إلى الكتالوج قد تُرسل إلى Cloudmersive للفحص الأمني. لا يتيح V2.0 للعملاء أو المبدعين رفع حزمهم إلى السوق.",
            "حالة الفحص والبصمة والحجم قد تُعرض علناً لمساعدة المستخدمين على تقييم التنزيل، لكن بيانات الوصول أو الأسرار لا يجب أن تُضمّن داخل ملفات عامة.",
          ],
        },
        {
          title: "ملفات تعريف الارتباط والتخزين المحلي",
          paragraphs: [
            "نستخدم ملفات تعريف ارتباط أو تخزيناً محلياً ضرورياً للجلسة، اللغة، السلة، تفضيلات العرض، والأمان. قد نستخدم قياسات مجمعة لمعرفة أداء الصفحات وتحسين التجربة.",
            "تعطيل التخزين الضروري قد يمنع تسجيل الدخول أو حفظ السلة أو بعض وظائف المكتبة.",
          ],
        },
        {
          title: "الاحتفاظ والحذف",
          paragraphs: [
            "نحتفظ ببيانات الحساب والطلب والدفع والاستحقاق والإيصال للمدة اللازمة لتقديم الوصول الدائم، حل النزاعات، منع الاحتيال، والوفاء بالمتطلبات القانونية والمحاسبية.",
            "قد تُحذف سجلات التشغيل والأمان أو تُجمّع بعد انتهاء الحاجة. طلب حذف الحساب لا يعني بالضرورة حذف السجلات التي يجب الاحتفاظ بها قانوناً، وقد يؤدي إلى فقدان القدرة على الوصول إلى المشتريات المرتبطة بالحساب بعد التحقق من الطلب.",
          ],
        },
        {
          title: "الأمان",
          paragraphs: [
            "نستخدم صلاحيات وصول، وسياسات أمان على مستوى الصفوف، وتخزيناً خاصاً، وروابط تنزيل موقّعة، وسجلات تدقيق، وفحص حزم، وضوابط معدل للمساعدة في حماية البيانات.",
            "لا توجد وسيلة نقل أو تخزين آمنة بنسبة مئة في المئة. لا ترسل كلمات مرور أو مفاتيح API أو بيانات بطاقة أو أسرار في نماذج الدعم أو حقول الموارد.",
          ],
        },
        {
          title: "حقوقك وخياراتك",
          paragraphs: [
            "بحسب القانون المنطبق، يمكنك طلب الوصول إلى معلوماتك أو تصحيحها أو حذفها أو الاعتراض على بعض المعالجة. يمكنك أيضاً تحديث بعض بيانات الحساب بنفسك وإلغاء الرسائل التسويقية عندما تكون متاحة.",
            "قد نطلب التحقق من الهوية قبل تنفيذ الطلب، وقد تنطبق استثناءات على سجلات المعاملات والأمان والالتزامات القانونية.",
          ],
        },
        {
          title: "الأطفال والنقل الدولي والتغييرات",
          paragraphs: [
            "الخدمة غير موجهة للأطفال الذين لا يملكون الأهلية القانونية لإبرام عملية شراء. إذا علمنا بجمع معلومات طفل خلافاً للقانون فسنتخذ إجراءً مناسباً.",
            "قد يعالج مقدمو الخدمات البيانات في دول أخرى مع تطبيق الضمانات المتاحة لديهم. سنحدّث هذه السياسة عند تغيّر ممارساتنا أو خدماتنا، ويظهر تاريخ آخر تحديث أعلى الصفحة.",
          ],
        },
      ],
      contactTitle: "أسئلة الخصوصية",
      contactDescription:
        "للاستفسار عن هذه السياسة أو تقديم طلب متعلق ببياناتك، تواصل معنا واذكر أن الرسالة تخص الخصوصية.",
    };
  }

  return {
    seoTitle: "Privacy policy · JojoPrompts",
    seoDescription:
      "How JojoPrompts collects, uses, and protects account, order, payment, download, and support data in V2.",
    title: "Privacy policy",
    updatedLabel: "Last updated: 28 July 2026",
    intro:
      "This policy explains how JojoPrompts handles information when you browse, create an account, acquire a resource, pay, download, or contact support. V2.0 does not include creator marketplace uploads or customer-submitted resource packages.",
    sections: [
      {
        title: "Information we collect",
        bullets: [
          "Account and profile data such as name, email, user identifier, and language preference.",
          "Order and entitlement data such as products, KWD amounts, order state, discounts, refunds, and Full Library credit.",
          "Payment identifiers, transaction state, settlement time, and payment method returned by the payment gateway.",
          "Download, version, and license records when needed to deliver a resource and protect entitlement access.",
          "Support messages and contact information you submit voluntarily.",
          "Limited operational and security data such as browser type, pages, errors, sign-in or rate-limit events, and network identifiers when needed for protection.",
        ],
      },
      {
        title: "Payments and card data",
        paragraphs: [
          "One-time payments are processed through UPayments. KNET, Visa, Mastercard, and Apple Pay may be offered depending on the device, card, and gateway configuration.",
          "We do not store full card numbers, security codes, or KNET credentials. We retain only the information needed for reconciliation, accounting, and entitlement delivery, such as transaction identifiers, amount, currency, result, and refund state.",
        ],
      },
      {
        title: "How we use information",
        bullets: [
          "Create accounts, authenticate users, and manage profiles.",
          "Create orders, verify payment, grant permanent entitlements, and prevent duplicate purchases.",
          "Calculate Full Library Lifetime credit and process refunds or related credit reversals.",
          "Authorize signed downloads and show versions, licenses, and receipts.",
          "Send transactional, security, and support messages, including order receipts.",
          "Detect fraud, abuse, and technical failures and improve performance and usability.",
          "Meet legal or accounting obligations and protect users and the platform.",
        ],
      },
      {
        title: "Service providers",
        paragraphs: [
          "We use Supabase for authentication, database, storage, and backend functions; UPayments for payment processing; Resend for email delivery; and Cloudmersive to scan Jojo catalog packages for malware. Hosting, monitoring, and operational analytics providers may also be used to run the site.",
          "Each provider receives only the information needed for its role and processes it under its own terms and safeguards. We do not sell personal information.",
        ],
      },
      {
        title: "Package files and security scanning",
        paragraphs: [
          "Resource packages uploaded by Jojo administrators may be sent to Cloudmersive for security scanning. V2.0 does not allow customers or creators to upload marketplace packages.",
          "Scan state, checksum, and size may be shown publicly to help users assess a download, but access data and secrets should never be included in public files.",
        ],
      },
      {
        title: "Cookies and local storage",
        paragraphs: [
          "We use cookies or local storage needed for sessions, language, cart, display preferences, and security. Aggregated measurements may be used to understand page performance and improve the experience.",
          "Disabling necessary storage may prevent sign-in, cart persistence, or some library features.",
        ],
      },
      {
        title: "Retention and deletion",
        paragraphs: [
          "We retain account, order, payment, entitlement, and receipt records as needed to provide permanent access, resolve disputes, prevent fraud, and meet legal and accounting requirements.",
          "Operational and security logs may be deleted or aggregated when no longer needed. Account deletion does not necessarily remove records we must retain by law and may affect access to purchases after the request is verified.",
        ],
      },
      {
        title: "Security",
        paragraphs: [
          "We use access controls, row-level security, private storage, signed download links, audit logs, package scanning, and rate controls to help protect information.",
          "No transmission or storage method is completely secure. Never send passwords, API keys, card details, or other secrets through support forms or resource fields.",
        ],
      },
      {
        title: "Your rights and choices",
        paragraphs: [
          "Depending on applicable law, you may request access, correction, deletion, or objection to certain processing. You may update some account details directly and opt out of marketing messages when offered.",
          "We may verify identity before fulfilling a request, and exceptions may apply to transaction, security, and legally required records.",
        ],
      },
      {
        title: "Children, international processing, and changes",
        paragraphs: [
          "The service is not directed to children who lack legal capacity to make a purchase. If we learn that information was collected from a child contrary to law, we will take appropriate action.",
          "Providers may process data in other countries under their available safeguards. We will update this policy when practices or services change, and the revision date appears above.",
        ],
      },
    ],
    contactTitle: "Privacy questions",
    contactDescription:
      "To ask about this policy or submit a data-related request, contact us and identify the message as a privacy request.",
  };
}
