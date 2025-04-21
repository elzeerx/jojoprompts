
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-start bg-gradient-to-b from-white to-[#F1F0FB]">
      <section className="w-full max-w-2xl text-center my-20 px-4">
        <img
          src="/lovable-uploads/51c278c2-e2f2-4630-8aed-a90ed9104030.png"
          alt="AI prompts gallery"
          className="mx-auto mb-10 w-40 h-40 rounded-full object-cover shadow-xl"
        />
        <h1 className="text-4xl font-extrabold mb-5 text-primary tracking-tight">
          Discover Unique AI Image Prompts
        </h1>
        <p className="text-lg text-muted-foreground mb-6">
          Unlock a curated collection of high-quality, ready-to-use AI image generation prompts.<br />
          <span className="font-semibold text-primary">Anyone can browse and use the prompts.</span> 
          <br />
          <span className="font-medium text-secondary">
            Only admins can add or create new prompts.
          </span>
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
          <Button asChild size="lg" className="font-semibold text-base px-8 py-4">
            <Link to="/prompts">Browse Prompts</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="font-semibold text-base px-8 py-4 border-primary/20">
            <a href="mailto:support@jojoprompts.com">Contact Admin</a>
          </Button>
        </div>
      </section>
      <section className="w-full md:max-w-4xl mt-10 px-4 flex flex-col items-center">
        <img
          src="/lovable-uploads/e5bc1c53-8cd5-42f0-a2c9-17d3771a0c88.png"
          alt="Prompt usage showcase"
          className="w-full max-w-xl rounded-xl shadow-lg border mb-6 object-cover"
        />
        <div className="text-center text-gray-700 text-md max-w-2xl">
          <span className="font-bold text-primary">JojoPrompts</span> helps creators and professionals get inspired with AI-generated visual ideas.<br />
          <b>Explore</b> — Save your favorites to access them quickly.<br />
          <b>Export</b> — Download your chosen prompts as PDFs for offline reference.<br />
          <span className="block mt-2 text-muted-foreground">New prompts are curated and uploaded by admins regularly.</span>
        </div>
      </section>
    </main>
  );
}
