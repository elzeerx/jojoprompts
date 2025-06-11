
import { Users } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="mobile-container-padding mobile-section-padding max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-warm-gold/10 p-3">
            <Users className="h-8 w-8 text-warm-gold" />
          </div>
        </div>
        <h1 className="section-title mb-4 text-dark-base">About JojoPrompts</h1>
        <p className="section-subtitle">
          Discover the story behind your favorite AI prompt collection
        </p>
      </div>

      <div className="prose prose-gray max-w-none">
        <div className="bg-warm-gold/5 p-6 rounded-lg border border-warm-gold/20 mb-8">
          <h2 className="text-xl font-semibold mb-3 text-dark-base">Our Mission</h2>
          <p className="text-muted-foreground">
            JojoPrompts was created to democratize access to high-quality AI prompts. 
            We believe everyone should have access to professionally crafted prompts 
            that unlock the full potential of AI tools like ChatGPT, Midjourney, and more.
          </p>
        </div>

        <div className="space-y-6">
          <section>
            <h3 className="text-lg font-semibold mb-3 text-dark-base">What We Offer</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Curated collection of premium AI prompts</li>
              <li>One-time payment model - pay once, use forever</li>
              <li>Regular updates with new prompt categories</li>
              <li>Easy-to-use interface for browsing and copying prompts</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-3 text-dark-base">Our Values</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Quality over quantity - every prompt is carefully tested</li>
              <li>Fair pricing - accessible to creators of all levels</li>
              <li>Community-driven - we listen to our users' needs</li>
              <li>Continuous improvement - always adding new features</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-3 text-dark-base">Get in Touch</h3>
            <p className="text-muted-foreground">
              Have questions or suggestions? We'd love to hear from you at{" "}
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
