import { LIFETIME_THRESHOLD_FILS, formatKwd } from "@/config/v2Flags";
import { Progress } from "@/components/ui/progress";
import { Sparkles } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

interface Props {
  progressFils: number;
  hasLibrary?: boolean;
  compact?: boolean;
}

export function LifetimeProgress({ progressFils, hasLibrary, compact }: Props) {
  const { language } = useTranslation();
  const isAr = language === "ar";
  const pct = Math.min(100, (progressFils / LIFETIME_THRESHOLD_FILS) * 100);
  if (hasLibrary) {
    return (
      <div className="rounded-xl border border-warm-gold/40 bg-warm-gold/10 px-4 py-3 text-sm">
        <div className="flex items-center gap-2 font-semibold">
          <Sparkles className="h-4 w-4 text-warm-gold" />
          {isAr ? "وصول مدى الحياة نشط" : "Lifetime access active"}
        </div>
        <p className="text-muted-foreground text-xs mt-1">
          {isAr
            ? "كل مورد منشور من Jojo مضمّن في مكتبتك."
            : "Every published Jojo resource is included in your library."}
        </p>
      </div>
    );
  }
  return (
    <div className={compact ? "space-y-1.5" : "rounded-xl border p-4 space-y-2"}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">
          {formatKwd(progressFils)} / {formatKwd(LIFETIME_THRESHOLD_FILS)} KD
        </span>
        <span className="text-muted-foreground">
          {isAr ? "نحو الوصول مدى الحياة" : "toward Lifetime"}
        </span>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}
