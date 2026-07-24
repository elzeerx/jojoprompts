import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Flag } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useNextLoginPath } from "@/hooks/v2/useNextLoginPath";
import {
  useSubmitResourceReport,
  type ReportCategory,
} from "@/hooks/v2/useSubmitResourceReport";

type Lang = "en" | "ar";

const CATEGORY_COPY: Record<ReportCategory, { en: string; ar: string }> = {
  copyright:     { en: "Copyright / IP concern", ar: "مخاوف بشأن حقوق الملكية" },
  harmful:       { en: "Harmful or unsafe",      ar: "محتوى ضار أو غير آمن" },
  inappropriate: { en: "Inappropriate content",  ar: "محتوى غير لائق" },
  spam:          { en: "Spam or misleading",     ar: "بريد مزعج أو مضلل" },
  malware:       { en: "Malware or security",    ar: "برامج ضارة أو مشكلة أمان" },
  other:         { en: "Other",                  ar: "أخرى" },
};

const T = {
  trigger: { en: "Report this resource", ar: "الإبلاغ عن هذا المورد" },
  title:   { en: "Report resource",      ar: "الإبلاغ عن مورد" },
  description: {
    en: "Tell us what's wrong. Our team reviews reports and takes action when needed.",
    ar: "أخبرنا بما هو غير صحيح. سيقوم فريقنا بمراجعة البلاغات واتخاذ الإجراءات اللازمة.",
  },
  categoryLabel: { en: "Category", ar: "الفئة" },
  categoryPlaceholder: { en: "Select a category", ar: "اختر الفئة" },
  detailsLabel: { en: "Details (optional)", ar: "التفاصيل (اختياري)" },
  detailsPlaceholder: {
    en: "Add context (max 2000 characters)",
    ar: "أضف التفاصيل (بحد أقصى 2000 حرف)",
  },
  submit:  { en: "Submit report", ar: "إرسال البلاغ" },
  cancel:  { en: "Cancel",        ar: "إلغاء" },
  close:   { en: "Close",         ar: "إغلاق" },
  ok:      { en: "Report submitted. Thanks for helping keep JojoPrompts safe.", ar: "تم إرسال البلاغ. شكرًا لمساعدتك في الحفاظ على سلامة JojoPrompts." },
  loginNeeded: { en: "Please sign in to submit a report.", ar: "يرجى تسجيل الدخول لإرسال بلاغ." },
  errRateLimited: { en: "You've reached the report limit. Please try again later.", ar: "لقد وصلت إلى الحد المسموح به من البلاغات. حاول لاحقًا." },
  errGeneric: { en: "Could not submit report. Please try again.", ar: "تعذر إرسال البلاغ. حاول مرة أخرى." },
};

const CATEGORIES: ReportCategory[] = [
  "copyright", "harmful", "inappropriate", "spam", "malware", "other",
];

interface Props {
  resourceId: string;
  lang: Lang;
}

export function ReportResourceButton({ resourceId, lang }: Props) {
  const { user } = useAuth();
  const nav = useNavigate();
  const nextPath = useNextLoginPath();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ReportCategory | "">("");
  const [details, setDetails] = useState("");
  const submit = useSubmitResourceReport();

  const handleOpen = () => {
    if (!user) {
      toast({ description: T.loginNeeded[lang] });
      nav(nextPath);
      return;
    }
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!category) return;
    try {
      await submit.mutateAsync({ resourceId, category, details: details.trim() || null });
      toast({ description: T.ok[lang] });
      setOpen(false);
      setDetails("");
      setCategory("");
    } catch (e) {
      const msg = (e as Error).message ?? "";
      const isLimited = /rate_limited|rate_limit_unavailable/i.test(msg);
      toast({
        variant: "destructive",
        title: T.title[lang],
        description: isLimited ? T.errRateLimited[lang] : T.errGeneric[lang],
      });
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleOpen}
        className="min-h-[44px] text-muted-foreground hover:text-foreground"
      >
        <Flag className="h-4 w-4 me-2" aria-hidden />
        {T.trigger[lang]}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{T.title[lang]}</DialogTitle>
            <DialogDescription>{T.description[lang]}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label htmlFor="report-category" className="mb-1 block text-sm font-medium">
                {T.categoryLabel[lang]}
              </label>
              <Select value={category} onValueChange={(v) => setCategory(v as ReportCategory)}>
                <SelectTrigger id="report-category" className="min-h-[44px]" aria-label={T.categoryLabel[lang]}>
                  <SelectValue placeholder={T.categoryPlaceholder[lang]} />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{CATEGORY_COPY[c][lang]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label htmlFor="report-details" className="mb-1 block text-sm font-medium">
                {T.detailsLabel[lang]}
              </label>
              <Textarea
                id="report-details"
                value={details}
                onChange={(e) => setDetails(e.target.value.slice(0, 2000))}
                rows={4}
                placeholder={T.detailsPlaceholder[lang]}
              />
              <div className="mt-1 text-right text-xs text-muted-foreground">
                {details.length} / 2000
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" className="min-h-[44px]" onClick={() => setOpen(false)}>
              {T.cancel[lang]}
            </Button>
            <Button
              className="min-h-[44px]"
              disabled={!category || submit.isPending}
              onClick={handleSubmit}
            >
              {submit.isPending ? "…" : T.submit[lang]}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
