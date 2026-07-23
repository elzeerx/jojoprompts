/**
 * Shared V2 admin commerce formatting helpers.
 * KWD is stored server-side as integer fils (1 KWD = 1000 fils).
 */

export function formatFils(fils: number | null | undefined, opts?: { withCode?: boolean }): string {
  const value = typeof fils === "number" && Number.isFinite(fils) ? fils : 0;
  const kwd = value / 1000;
  const formatted = kwd.toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
  return opts?.withCode === false ? formatted : `${formatted} KWD`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function formatAge(seconds: number | null | undefined): string {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) return "—";
  const s = Math.floor(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

/** Bilingual English + Arabic label pairs used across V2 admin operations. */
export const BILINGUAL = {
  copyId: { en: "Copy ID", ar: "نسخ المعرف" },
  copyOrderNumber: { en: "Copy order number", ar: "نسخ رقم الطلب" },
  copied: { en: "Copied", ar: "تم النسخ" },
  print: { en: "Print", ar: "طباعة" },
  close: { en: "Close", ar: "إغلاق" },
  loading: { en: "Loading…", ar: "جارٍ التحميل…" },
  empty: { en: "No results", ar: "لا توجد نتائج" },
  error: { en: "Something went wrong", ar: "حدث خطأ ما" },
  retry: { en: "Retry", ar: "إعادة المحاولة" },
  filters: { en: "Filters", ar: "التصفية" },
  clear: { en: "Clear", ar: "مسح" },
  search: { en: "Search", ar: "بحث" },
  status: { en: "Status", ar: "الحالة" },
  provider: { en: "Provider", ar: "المزود" },
  order: { en: "Order", ar: "الطلب" },
  customer: { en: "Customer", ar: "العميل" },
  amount: { en: "Amount", ar: "المبلغ" },
  created: { en: "Created", ar: "أُنشئ" },
  settled: { en: "Settled", ar: "سُوّي" },
  requested: { en: "Requested", ar: "طُلب" },
  processed: { en: "Processed", ar: "عُولج" },
  reason: { en: "Reason", ar: "السبب" },
  scope: { en: "Scope", ar: "النطاق" },
  state: { en: "State", ar: "الحالة" },
  active: { en: "Active", ar: "نشط" },
  revoked: { en: "Revoked", ar: "مُلغى" },
  expired: { en: "Expired", ar: "منتهي" },
  immutable: {
    en: "Payment events are immutable — no edit or delete.",
    ar: "أحداث الدفع غير قابلة للتعديل — لا تعديل ولا حذف.",
  },
} as const;

export function bi(k: keyof typeof BILINGUAL): string {
  return `${BILINGUAL[k].en} / ${BILINGUAL[k].ar}`;
}

/** Compact bilingual label for badges/buttons where slash pair is too long. */
export function biShort(k: keyof typeof BILINGUAL): string {
  return BILINGUAL[k].en;
}

export function statusTone(status: string | null | undefined): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "paid":
    case "processed":
    case "captured":
    case "authorized":
      return "default";
    case "pending":
    case "approved":
    case "created":
      return "secondary";
    case "failed":
    case "denied":
    case "chargeback":
    case "reversal":
      return "destructive";
    case "refunded":
    case "partially_refunded":
    case "cancelled":
      return "outline";
    default:
      return "outline";
  }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
