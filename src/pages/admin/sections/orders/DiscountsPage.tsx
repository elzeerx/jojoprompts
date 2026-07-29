import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Search, Archive, Eye, Pencil, Power } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  useAdminDiscounts,
  useSetDiscountActive,
  useArchiveDiscount,
  humanizeDiscountError,
  type DiscountRow,
  type DiscountStatus,
} from "@/hooks/admin/v2/useAdminDiscounts";
import { formatFils, formatDateTime, bi } from "@/lib/v2/admin/format";
import { DiscountEditorDialog } from "./DiscountEditorDialog";
import { DiscountDetailSheet } from "./DiscountDetailSheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PAGE_SIZE = 25;

const STATUS_TONE: Record<DiscountStatus, string> = {
  active: "bg-emerald-100 text-emerald-800 border-emerald-200",
  scheduled: "bg-sky-100 text-sky-800 border-sky-200",
  expired: "bg-gray-100 text-gray-700 border-gray-200",
  exhausted: "bg-amber-100 text-amber-800 border-amber-200",
  inactive: "bg-slate-100 text-slate-700 border-slate-200",
  archived: "bg-zinc-100 text-zinc-500 border-zinc-200",
};

const STATUS_LABEL: Record<DiscountStatus, { en: string; ar: string }> = {
  active: { en: "Active", ar: "نشط" },
  scheduled: { en: "Scheduled", ar: "مجدول" },
  expired: { en: "Expired", ar: "منتهي" },
  exhausted: { en: "Exhausted", ar: "مستنفد" },
  inactive: { en: "Inactive", ar: "غير مفعل" },
  archived: { en: "Archived", ar: "مؤرشف" },
};

export default function DiscountsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("q") ?? "";
  const status = (searchParams.get("status") as DiscountStatus | null) ?? null;
  const kind = (searchParams.get("kind") as "percent" | "fixed_fils" | null) ?? null;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<DiscountRow | null>(null);

  const query = useAdminDiscounts({
    search: search || null,
    status,
    kind,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const setActive = useSetDiscountActive();
  const archive = useArchiveDiscount();

  const updateParam = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    if (!("page" in patch)) next.delete("page");
    setSearchParams(next, { replace: true });
  };

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((query.data?.total_count ?? 0) / PAGE_SIZE)),
    [query.data?.total_count]
  );

  const rows = query.data?.rows ?? [];

  const handleToggleActive = async (row: DiscountRow) => {
    try {
      await setActive.mutateAsync({ id: row.id, is_active: !row.is_active });
      toast({
        title: !row.is_active ? "Activated / تم التفعيل" : "Deactivated / تم الإيقاف",
      });
    } catch (err) {
      const msg = humanizeDiscountError(err);
      toast({ variant: "destructive", title: msg.en, description: msg.ar });
    }
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;
    try {
      await archive.mutateAsync(archiveTarget.id);
      toast({ title: "Archived / تمت الأرشفة" });
      setArchiveTarget(null);
    } catch (err) {
      const msg = humanizeDiscountError(err);
      toast({ variant: "destructive", title: msg.en, description: msg.ar });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-base">
            Discounts <span className="text-muted-foreground text-lg">/ الخصومات</span>
          </h1>
          <p className="text-muted-foreground text-sm">
            Manage V2 one-time discount codes. Server-authoritative pricing; historical orders remain
            immutable.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingId(null);
            setEditorOpen(true);
          }}
          className="bg-warm-gold hover:bg-warm-gold/90 min-h-[44px]"
        >
          <Plus className="mr-2 h-4 w-4" />
          {bi("filters").split(" / ")[0] /* placeholder no-op */}
          New code / رمز جديد
        </Button>
      </div>

      <Card className="border-warm-gold/20 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              aria-label="Search discount codes"
              placeholder="Search code / بحث برمز"
              defaultValue={search}
              onChange={(e) => updateParam({ q: e.target.value })}
              className="pl-9 min-h-[44px]"
            />
          </div>
          <Select
            value={status ?? "__all"}
            onValueChange={(v) => updateParam({ status: v === "__all" ? null : v })}
          >
            <SelectTrigger className="min-h-[44px]">
              <SelectValue placeholder="Status / الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All statuses / كل الحالات</SelectItem>
              {(Object.keys(STATUS_LABEL) as DiscountStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s].en} / {STATUS_LABEL[s].ar}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={kind ?? "__all"}
            onValueChange={(v) => updateParam({ kind: v === "__all" ? null : v })}
          >
            <SelectTrigger className="min-h-[44px]">
              <SelectValue placeholder="Type / النوع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All types / كل الأنواع</SelectItem>
              <SelectItem value="percent">Percentage / نسبة</SelectItem>
              <SelectItem value="fixed_fils">Fixed KWD / مبلغ ثابت</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {query.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-warm-gold" />
        </div>
      ) : query.isError ? (
        <Card className="p-8 text-center">
          <p className="text-destructive font-medium">Failed to load discounts / فشل التحميل</p>
          <Button variant="outline" className="mt-3" onClick={() => query.refetch()}>
            Retry / إعادة
          </Button>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          No discount codes yet / لا توجد رموز خصم بعد
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3">Code / الرمز</th>
                  <th className="p-3">Type / النوع</th>
                  <th className="p-3">Scope / النطاق</th>
                  <th className="p-3">Window / النافذة</th>
                  <th className="p-3">Usage / الاستخدام</th>
                  <th className="p-3">Status / الحالة</th>
                  <th className="p-3">Updated / التحديث</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/30">
                    <td className="p-3 font-mono">{row.code}</td>
                    <td className="p-3">
                      {row.kind === "percent"
                        ? `${row.value}%`
                        : `${formatFils(row.value, { withCode: false })} KWD`}
                    </td>
                    <td className="p-3">
                      {row.applies_to_all
                        ? "All products"
                        : `${row.applicable_product_count} product(s)`}
                      {row.applies_to_lifetime && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Lifetime
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-xs">
                      {row.starts_at ? formatDateTime(row.starts_at) : "—"}
                      <br />→ {row.expires_at ? formatDateTime(row.expires_at) : "∞"}
                    </td>
                    <td className="p-3">
                      {row.used_count}
                      {row.max_total_uses ? ` / ${row.max_total_uses}` : ""}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={STATUS_TONE[row.status]}>
                        {STATUS_LABEL[row.status].en}
                      </Badge>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {formatDateTime(row.updated_at)}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="min-h-[44px] min-w-[44px]"
                          title="View / عرض"
                          onClick={() => setDetailId(row.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {row.status !== "archived" && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="min-h-[44px] min-w-[44px]"
                              title="Edit / تعديل"
                              onClick={() => {
                                setEditingId(row.id);
                                setEditorOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="min-h-[44px] min-w-[44px]"
                              title={row.is_active ? "Deactivate" : "Activate"}
                              onClick={() => handleToggleActive(row)}
                              disabled={setActive.isPending}
                            >
                              <Power
                                className={`h-4 w-4 ${
                                  row.is_active ? "text-emerald-600" : "text-muted-foreground"
                                }`}
                              />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="min-h-[44px] min-w-[44px]"
                              title="Archive / أرشفة"
                              onClick={() => setArchiveTarget(row)}
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {rows.map((row) => (
              <Card key={row.id} className="p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-mono font-semibold">{row.code}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.kind === "percent"
                        ? `${row.value}%`
                        : `${formatFils(row.value)}`}{" "}
                      · {row.applies_to_all ? "All" : `${row.applicable_product_count} products`}
                      {row.applies_to_lifetime ? " · Lifetime" : ""}
                    </div>
                  </div>
                  <Badge variant="outline" className={STATUS_TONE[row.status]}>
                    {STATUS_LABEL[row.status].en}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Used {row.used_count}
                  {row.max_total_uses ? ` / ${row.max_total_uses}` : ""} · Updated{" "}
                  {formatDateTime(row.updated_at)}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-[44px]"
                    onClick={() => setDetailId(row.id)}
                  >
                    <Eye className="h-4 w-4 mr-1" /> View
                  </Button>
                  {row.status !== "archived" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-[44px]"
                        onClick={() => {
                          setEditingId(row.id);
                          setEditorOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-1" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-[44px]"
                        onClick={() => handleToggleActive(row)}
                      >
                        <Power className="h-4 w-4 mr-1" />
                        {row.is_active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-[44px] text-destructive"
                        onClick={() => setArchiveTarget(row)}
                      >
                        <Archive className="h-4 w-4 mr-1" /> Archive
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>

          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>
              Page {page} / {totalPages} · {query.data?.total_count ?? 0} total
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px]"
                disabled={page <= 1}
                onClick={() => updateParam({ page: String(page - 1) })}
              >
                ← Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px]"
                disabled={page >= totalPages}
                onClick={() => updateParam({ page: String(page + 1) })}
              >
                Next →
              </Button>
            </div>
          </div>
        </>
      )}

      <DiscountEditorDialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        discountId={editingId}
      />

      <DiscountDetailSheet
        discountId={detailId}
        onClose={() => setDetailId(null)}
        onEdit={(id) => {
          setDetailId(null);
          setEditingId(id);
          setEditorOpen(true);
        }}
      />

      <AlertDialog open={!!archiveTarget} onOpenChange={(o) => !o && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive discount / أرشفة الخصم</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono">{archiveTarget?.code}</span> will be deactivated and hidden
              from future checkouts. Historical redemptions on paid orders remain unchanged. Discount
              codes are unique forever — this code cannot be reused after archiving; create a new
              unique code instead. This cannot be undone.
              <br />
              <span dir="rtl" className="block mt-2">
                سيتم إيقاف الرمز وإخفاؤه من عمليات الشراء المستقبلية مع الحفاظ على السجلات السابقة.
                الرموز فريدة دائمًا — لا يمكن إعادة استخدام هذا الرمز بعد الأرشفة؛ أنشئ رمزًا جديدًا فريدًا.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel / إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              className="bg-destructive hover:bg-destructive/90"
            >
              Archive / أرشفة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
