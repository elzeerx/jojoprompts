import { Sparkles } from "lucide-react";

export function EmptyCatalog({
  title = "The V2 catalog is launching soon",
  description = "We're preparing verified skills, automations, prompts, image styles, and bundles. Check back shortly — or explore the current library from the main site.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-2xl border border-dashed border-warm-gold/40 bg-warm-gold/5 p-8 text-center">
      <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-warm-gold/15 text-warm-gold">
        <Sparkles className="h-5 w-5" />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
