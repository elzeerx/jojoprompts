import { Mail } from "lucide-react";
import { SeoHead } from "@/components/v2/SeoHead";

export interface LegalSection {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
}

interface LegalDocumentPageProps {
  dir: "ltr" | "rtl";
  seoTitle: string;
  seoDescription: string;
  canonicalPath: string;
  title: string;
  updatedLabel: string;
  intro: string;
  sections: LegalSection[];
  contactTitle: string;
  contactDescription: string;
}

export function LegalDocumentPage({
  dir,
  seoTitle,
  seoDescription,
  canonicalPath,
  title,
  updatedLabel,
  intro,
  sections,
  contactTitle,
  contactDescription,
}: LegalDocumentPageProps) {
  return (
    <main dir={dir} className="bg-background text-foreground">
      <SeoHead
        title={seoTitle}
        description={seoDescription}
        canonicalPath={canonicalPath}
      />

      <section className="border-b border-border/60 bg-gradient-to-b from-warm-gold/10 to-transparent">
        <div className="container mx-auto max-w-4xl px-4 py-12 sm:py-16">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{updatedLabel}</p>
        </div>
      </section>

      <article className="container mx-auto max-w-4xl space-y-8 px-4 py-10 text-sm leading-relaxed sm:text-base">
        <div className="rounded-2xl border border-warm-gold/40 bg-warm-gold/5 p-5 text-muted-foreground">
          {intro}
        </div>

        {sections.map((section, index) => (
          <section key={section.title} aria-labelledby={`legal-section-${index + 1}`}>
            <h2 id={`legal-section-${index + 1}`} className="text-xl font-semibold text-foreground">
              {index + 1}. {section.title}
            </h2>
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph} className="mt-3 text-muted-foreground">
                {paragraph}
              </p>
            ))}
            {section.bullets?.length ? (
              <ul className="mt-3 list-disc space-y-2 ps-6 text-muted-foreground">
                {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
              </ul>
            ) : null}
          </section>
        ))}

        <section className="rounded-2xl border bg-card p-5" aria-labelledby="legal-contact">
          <Mail className="h-5 w-5 text-warm-gold" aria-hidden />
          <h2 id="legal-contact" className="mt-3 text-xl font-semibold">{contactTitle}</h2>
          <p className="mt-2 text-muted-foreground">{contactDescription}</p>
          <a
            href="mailto:info@jojoprompts.com"
            className="mt-3 inline-flex min-h-[44px] items-center font-medium text-warm-gold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-gold"
          >
            info@jojoprompts.com
          </a>
        </section>
      </article>
    </main>
  );
}
