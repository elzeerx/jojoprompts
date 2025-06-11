
import { Shield } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="mobile-container-padding mobile-section-padding max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-warm-gold/10 p-3">
            <Shield className="h-8 w-8 text-warm-gold" />
          </div>
        </div>
        <h1 className="section-title mb-4 text-dark-base">Privacy Policy</h1>
        <p className="section-subtitle">
          Your privacy and data protection are our top priorities
        </p>
      </div>

      <div className="prose prose-gray max-w-none">
        <div className="bg-warm-gold/5 p-6 rounded-lg border border-warm-gold/20 mb-8">
          <h2 className="text-xl font-semibold mb-3 text-dark-base">Privacy Policy Coming Soon</h2>
          <p className="text-muted-foreground">
            We are currently preparing our comprehensive privacy policy to ensure complete transparency 
            about how we collect, use, and protect your personal information.
          </p>
          <p className="text-muted-foreground mt-3">
            In the meantime, rest assured that we follow industry best practices for data protection 
            and never share your personal information with third parties without your explicit consent.
          </p>
        </div>

        <div className="space-y-6">
          <section>
            <h3 className="text-lg font-semibold mb-3 text-dark-base">Quick Overview</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>We only collect necessary information for providing our services</li>
              <li>Your payment information is processed securely through encrypted channels</li>
              <li>We do not sell or rent your personal information to third parties</li>
              <li>You have full control over your account and data</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-3 text-dark-base">Contact Us</h3>
            <p className="text-muted-foreground">
              If you have any questions about privacy or data protection, please contact us at{" "}
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
