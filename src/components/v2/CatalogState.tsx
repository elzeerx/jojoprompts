import { Sparkles } from "lucide-react";
import { V2_COPY } from "@/config/v2Flags";
import { useTranslation } from "@/hooks/useTranslation";

interface Props {
  variant?: "empty" | "no-results" | "error";
  onRetry?: () => void;
}

export function CatalogState({ variant = "empty", onRetry }: Props) {
  const { language } = useTranslation();
  const lang = (language as "en" | "ar") ?? "en";
  let title: string = V2_COPY.states.emptyCatalogTitle[lang];
  let desc: string = V2_COPY.states.emptyCatalogDesc[lang];
  if (variant === "no-results") {
    title = V2_COPY.states.noResultsTitle[lang];
    desc = V2_COPY.states.noResultsDesc[lang];
  } else if (variant === "error") {
    title = V2_COPY.states.error[lang];
    desc = "";
  }
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-2xl border border-dashed border-warm-gold/40 bg-warm-gold/5 p-8 text-center">
      <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-warm-gold/15 text-warm-gold">
        <Sparkles className="h-5 w-5" aria-hidden />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {desc ? <p className="mt-2 text-sm text-muted-foreground">{desc}</p> : null}
      {variant === "error" && onRetry ? (
        <button
          onClick={onRetry}
          className="mt-4 rounded-md bg-warm-gold px-4 py-2 text-sm font-semibold text-dark-base min-h-[44px]"
        >
          {V2_COPY.library.retry[lang]}
        </button>
      ) : null}
    </div>
  );
}
