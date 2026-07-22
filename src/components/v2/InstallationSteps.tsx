import { V2_COPY } from "@/config/v2Flags";
import { useTranslation } from "@/hooks/useTranslation";

type Lang = "en" | "ar";

interface StepObject {
  title?: string;
  body?: string;
}

type Step = string | StepObject;

interface Props {
  stepsEn: unknown;
  stepsAr: unknown;
}

function normalizeSteps(value: unknown): Step[] | null {
  if (value == null) return null;
  if (Array.isArray(value)) {
    const cleaned = value
      .map((item): Step | null => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const obj = item as Record<string, unknown>;
          const title = typeof obj.title === "string" ? obj.title : undefined;
          const body = typeof obj.body === "string" ? obj.body : undefined;
          if (title || body) return { title, body };
        }
        return null;
      })
      .filter((s): s is Step => s !== null);
    return cleaned.length > 0 ? cleaned : null;
  }
  if (typeof value === "string" && value.trim().length > 0) return [value];
  return null;
}

export function InstallationSteps({ stepsEn, stepsAr }: Props) {
  const { language } = useTranslation();
  const lang: Lang = language === "ar" ? "ar" : "en";
  const source = lang === "ar" && stepsAr != null ? stepsAr : stepsEn;
  const steps = normalizeSteps(source) ?? normalizeSteps(stepsEn);
  if (!steps || steps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {V2_COPY.detail.stepsUnavailable[lang]}
      </p>
    );
  }
  return (
    <ol className="list-decimal space-y-2 ps-5 text-sm">
      {steps.map((s, i) => {
        if (typeof s === "string") {
          return (
            <li key={i} className="leading-relaxed">
              {s}
            </li>
          );
        }
        return (
          <li key={i} className="leading-relaxed">
            {s.title ? <div className="font-medium">{s.title}</div> : null}
            {s.body ? (
              <div className="text-muted-foreground whitespace-pre-line">
                {s.body}
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
