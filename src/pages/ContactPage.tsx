import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Clock, FileQuestion, Loader2, Mail, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SeoHead } from "@/components/v2/SeoHead";
import { useTranslation } from "@/hooks/useTranslation";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { createLogger } from "@/utils/logging";
import { generateUuidV4 } from "@/utils/uuid";

const logger = createLogger("CONTACT_PAGE");

interface ContactFunctionResponse {
  success?: boolean;
  error?: string;
  confirmation_sent?: boolean;
}

export default function ContactPage() {
  const { language, isRTL } = useTranslation();
  const lang: "en" | "ar" = language === "ar" ? "ar" : "en";
  const t = contactCopy(lang);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const submission_id = generateUuidV4();
      const { data, error } = await supabase.functions.invoke("submit-contact", {
        body: {
          submission_id,
          name: formData.name,
          email: formData.email,
          subject: formData.subject,
          message: formData.message,
        },
      });
      const response = parseContactResponse(data);

      if (error || response.success !== true) {
        const code = response.error ?? error?.message ?? "submission_failed";
        toast({
          title: code === "rate_limited" ? t.rateLimitedTitle : t.errorTitle,
          description:
            code === "rate_limited" ? t.rateLimitedDescription : t.errorDescription,
          variant: "destructive",
        });
        logger.warn("Contact submission failed", { code });
        return;
      }

      toast({
        title: t.successTitle,
        description: response.confirmation_sent
          ? t.successWithConfirmation
          : t.successWithoutConfirmation,
      });
      setFormData({ name: "", email: "", subject: "", message: "" });
    } catch (error: unknown) {
      logger.error("Contact form exception", { error: errorMessage(error) });
      toast({
        title: t.errorTitle,
        description: t.errorDescription,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  return (
    <main dir={isRTL ? "rtl" : "ltr"} className="bg-background text-foreground">
      <SeoHead
        title={t.seoTitle}
        description={t.seoDescription}
        canonicalPath="/contact"
      />

      <section className="border-b border-border/60 bg-gradient-to-b from-warm-gold/10 to-transparent">
        <div className="container mx-auto max-w-4xl px-4 py-12 text-center sm:py-16">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t.title}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">
            {t.subtitle}
          </p>
        </div>
      </section>

      <div className="container mx-auto grid max-w-5xl gap-6 px-4 py-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
        <section className="rounded-2xl border bg-card p-5 sm:p-7" aria-labelledby="contact-form-title">
          <h2 id="contact-form-title" className="text-xl font-semibold">{t.formTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.formDescription}</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contact-name">{t.name}</Label>
                <Input
                  id="contact-name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  minLength={1}
                  maxLength={120}
                  autoComplete="name"
                  className="min-h-[44px]"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-email">{t.email}</Label>
                <Input
                  id="contact-email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  maxLength={320}
                  autoComplete="email"
                  inputMode="email"
                  className="min-h-[44px]"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-subject">{t.subject}</Label>
              <Input
                id="contact-subject"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                minLength={1}
                maxLength={200}
                className="min-h-[44px]"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-message">{t.message}</Label>
              <Textarea
                id="contact-message"
                name="message"
                rows={7}
                value={formData.message}
                onChange={handleChange}
                minLength={1}
                maxLength={5000}
                className="min-h-[160px]"
                required
              />
              <p className="text-xs text-muted-foreground">{t.privacyNote}</p>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[44px] w-full bg-warm-gold text-dark-base hover:bg-warm-gold/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
                  {t.sending}
                </>
              ) : (
                t.send
              )}
            </Button>
          </form>
        </section>

        <aside className="space-y-5" aria-label={t.supportInformation}>
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="text-lg font-semibold">{t.contactTitle}</h2>
            <div className="mt-4 space-y-4">
              <ContactFact
                icon={Mail}
                title={t.emailSupport}
                description="info@jojoprompts.com"
              />
              <ContactFact
                icon={ReceiptText}
                title={t.orderSupport}
                description={t.orderSupportDescription}
              />
              <ContactFact
                icon={Clock}
                title={t.responseTime}
                description={t.responseTimeDescription}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-warm-gold/40 bg-warm-gold/5 p-5">
            <FileQuestion className="h-6 w-6 text-warm-gold" aria-hidden />
            <h2 className="mt-3 text-lg font-semibold">{t.beforeWriting}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t.beforeWritingDescription}
            </p>
            <Button asChild variant="outline" className="mt-4 min-h-[44px]">
              <Link to="/faq">{t.openFaq}</Link>
            </Button>
          </section>
        </aside>
      </div>
    </main>
  );
}

function ContactFact({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Mail;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warm-gold/10">
        <Icon className="h-5 w-5 text-warm-gold" aria-hidden />
      </span>
      <div className="min-w-0">
        <h3 className="font-medium">{title}</h3>
        <p className="break-words text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function parseContactResponse(value: unknown): ContactFunctionResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  return {
    success: typeof raw.success === "boolean" ? raw.success : undefined,
    error: typeof raw.error === "string" ? raw.error : undefined,
    confirmation_sent:
      typeof raw.confirmation_sent === "boolean" ? raw.confirmation_sent : undefined,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown_error";
}

function contactCopy(lang: "en" | "ar") {
  if (lang === "ar") {
    return {
      seoTitle: "تواصل معنا · JojoPrompts",
      seoDescription:
        "تواصل مع دعم JojoPrompts بشأن الموارد، التنزيلات، الطلبات، الدفعات لمرة واحدة، أو الاسترداد.",
      title: "تواصل معنا",
      subtitle:
        "أرسل سؤالك عن مورد أو تنزيل أو طلب أو دفعة. أرفق رقم الطلب عندما يكون متاحاً.",
      formTitle: "أرسل رسالة",
      formDescription: "تصل رسالتك إلى فريق JojoPrompts عبر البريد الإلكتروني.",
      name: "الاسم",
      email: "البريد الإلكتروني",
      subject: "الموضوع",
      message: "الرسالة",
      privacyNote:
        "لا ترسل كلمات مرور أو مفاتيح API أو أرقام بطاقات أو أي أسرار داخل الرسالة.",
      sending: "جارٍ الإرسال…",
      send: "أرسل الرسالة",
      supportInformation: "معلومات الدعم",
      contactTitle: "طرق المساعدة",
      emailSupport: "دعم البريد الإلكتروني",
      orderSupport: "دعم الطلبات والدفعات",
      orderSupportDescription: "أرفق رقم الطلب ولا تكرر الدفع قبل التحقق.",
      responseTime: "وقت الرد",
      responseTimeDescription: "نهدف إلى الرد خلال 24 ساعة.",
      beforeWriting: "قد تجد الإجابة فوراً",
      beforeWritingDescription:
        "راجع الأسئلة الشائعة لمعرفة تفاصيل الملكية الدائمة، التثبيت، طرق الدفع، الاسترداد، وحقوق العملاء السابقين.",
      openFaq: "افتح الأسئلة الشائعة",
      rateLimitedTitle: "تم إرسال رسائل كثيرة",
      rateLimitedDescription: "يرجى المحاولة مجدداً بعد ساعة.",
      errorTitle: "تعذر إرسال الرسالة",
      errorDescription:
        "حاول مرة أخرى أو أرسل بريداً إلى info@jojoprompts.com.",
      successTitle: "تم استلام رسالتك",
      successWithConfirmation:
        "أرسلنا تأكيداً إلى بريدك وسنرد خلال 24 ساعة.",
      successWithoutConfirmation: "تم استلام الرسالة وسنرد خلال 24 ساعة.",
    };
  }
  return {
    seoTitle: "Contact JojoPrompts",
    seoDescription:
      "Contact JojoPrompts support about resources, downloads, orders, one-time payments, or refunds.",
    title: "Contact us",
    subtitle:
      "Send your question about a resource, download, order, or payment. Include the order number when available.",
    formTitle: "Send a message",
    formDescription: "Your message is delivered to the JojoPrompts team by email.",
    name: "Name",
    email: "Email",
    subject: "Subject",
    message: "Message",
    privacyNote:
      "Never include passwords, API keys, card numbers, or other secrets in your message.",
    sending: "Sending…",
    send: "Send message",
    supportInformation: "Support information",
    contactTitle: "How we can help",
    emailSupport: "Email support",
    orderSupport: "Order and payment support",
    orderSupportDescription: "Include the order number and do not pay again before checking.",
    responseTime: "Response time",
    responseTimeDescription: "We aim to reply within 24 hours.",
    beforeWriting: "You may find the answer immediately",
    beforeWritingDescription:
      "Check the FAQ for permanent ownership, installation, payment methods, refunds, and previous-customer rights.",
    openFaq: "Open the FAQ",
    rateLimitedTitle: "Too many messages",
    rateLimitedDescription: "Please try again in one hour.",
    errorTitle: "Message could not be sent",
    errorDescription:
      "Try again or email info@jojoprompts.com directly.",
    successTitle: "Message received",
    successWithConfirmation:
      "We sent a confirmation to your email and will reply within 24 hours.",
    successWithoutConfirmation: "We received your message and will reply within 24 hours.",
  };
}
