
import { FileText } from "lucide-react";

export default function TermsOfServicePage() {
  return (
    <div className="mobile-container-padding mobile-section-padding max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-warm-gold/10 p-3">
            <FileText className="h-8 w-8 text-warm-gold" />
          </div>
        </div>
        <h1 className="section-title mb-4 text-dark-base">Terms of Service</h1>
        <p className="section-subtitle">
          Understanding your rights and responsibilities when using JojoPrompts
        </p>
      </div>

      <div className="prose prose-gray max-w-none">
        <div className="bg-warm-gold/5 p-6 rounded-lg border border-warm-gold/20 mb-8">
          <h2 className="text-xl font-semibold mb-3 text-dark-base">Terms of Service Coming Soon</h2>
          <p className="text-muted-foreground">
            We are currently finalizing our comprehensive terms of service to clearly outline 
            the rights and responsibilities for all JojoPrompts users.
          </p>
          <p className="text-muted-foreground mt-3">
            By using our service, you agree to use our AI prompts responsibly and in accordance 
            with applicable laws and regulations.
          </p>
        </div>

        <div className="space-y-6">
          <section>
            <h3 className="text-lg font-semibold mb-3 text-dark-base">Key Points</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Use our prompts responsibly and ethically</li>
              <li>Respect intellectual property rights</li>
              <li>One-time payments provide access for the specified duration</li>
              <li>No refunds after accessing premium content</li>
              <li>We reserve the right to terminate accounts for misuse</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-3 text-dark-base">Questions?</h3>
            <p className="text-muted-foreground">
              If you have any questions about our terms of service, please contact us at{" "}
              <a href="mailto:support@jojoprompts.com" className="text-warm-gold hover:underline">
                support@jojoprompts.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
