import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Sparkles, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Legacy {
  label: string;
  to: string;
}

interface Props {
  title: string;
  description: string;
  legacy?: Legacy[];
  extra?: ReactNode;
}

/**
 * Contextual empty state for admin V2 routes that are wired but not yet
 * functional. Never fake numbers; always link the corresponding legacy tool
 * so admins can continue working while the V2 surface is built out.
 */
export function EmptyRouteState({ title, description, legacy, extra }: Props) {
  return (
    <div className="rounded-lg border border-dashed border-warm-gold/40 bg-warm-gold/5 p-6 md:p-10">
      <div className="mx-auto flex max-w-xl flex-col items-start gap-4">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-warm-gold/15 text-warm-gold">
          <Sparkles className="h-5 w-5" aria-hidden />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold text-dark-base">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {legacy && legacy.length > 0 ? (
          <div className="w-full">
            <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
              Continue with legacy tool
            </p>
            <div className="flex flex-wrap gap-2">
              {legacy.map((l) => (
                <Button key={l.to} asChild size="sm" variant="outline" className="min-h-[36px]">
                  <Link to={l.to} className="inline-flex items-center gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    {l.label}
                  </Link>
                </Button>
              ))}
            </div>
          </div>
        ) : null}
        {extra}
      </div>
    </div>
  );
}
