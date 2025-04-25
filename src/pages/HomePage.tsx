import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
export default function HomePage() {
  return <main className="min-h-screen flex flex-col items-center justify-start bg-gradient-to-b from-white to-[#F1F0FB]">
      <section className="w-full max-w-4xl text-center my-20 px-4">
        <img src="/lovable-uploads/eea1bdcd-7738-4e5f-810a-15c96fe07b94.png" alt="JojoPrompts hero" className="mx-auto mb-10 w-full rounded-xl shadow-xl object-cover" />
        <h1 className="text-4xl font-extrabold mb-5 text-primary tracking-tight">Discover Unique AI Prompts</h1>
        <p className="text-lg text-muted-foreground mb-6">
          Unlock a curated collection of high-quality, ready-to-use AI image generation prompts.<br />
          <span className="font-semibold text-primary">Browse and use the prompts in ChatGPT</span><br />
          
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
    </main>;
}