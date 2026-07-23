import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  useAdminDiscount,
  useUpsertDiscount,
  useAdminDiscountProductSearch,
  humanizeDiscountError,
} from "@/hooks/admin/v2/useAdminDiscounts";
import { formatFils } from "@/lib/v2/admin/format";

interface Props {
  open: boolean;
  onClose: () => void;
  discountId: string | null;
}

const emptyForm = {
  code: "",
  kind: "percent" as "percent" | "fixed_fils",
  valueStr: "",
  starts_at: "",
  expires_at: "",
  min_order_kwd: "",
  max_total_uses: "",
  max_uses_per_user: "",
  applies_to_all: true,
  applies_to_lifetime: false,
  applicable_product_ids: [] as string[],
  is_active: true,
  notes: "",
};

function toIsoOrNull(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function isoToLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60_000);
  return local.toISOString().slice(0, 16);
}

export function DiscountEditorDialog({ open, onClose, discountId }: Props) {
  const isEdit = !!discountId;
  const detail = useAdminDiscount(open ? discountId : null);
  const upsert = useUpsertDiscount();

  const [form, setForm] = useState(emptyForm);
  const [productSearch, setProductSearch] = useState("");
  const products = useAdminDiscountProductSearch(productSearch);

  useEffect(() => {
    if (!open) return;
    if (isEdit && detail.data) {
      const d = detail.data;
      setForm({
        code: d.code,
        kind: d.kind,
        valueStr:
          d.kind === "percent" ? String(d.value) : (d.value / 1000).toFixed(3),
        starts_at: isoToLocal(d.starts_at),
        expires_at: isoToLocal(d.expires_at),
        min_order_kwd: d.min_order_fils ? (d.min_order_fils / 1000).toFixed(3) : "",
        max_total_uses: d.max_total_uses ? String(d.max_total_uses) : "",
        max_uses_per_user: d.max_uses_per_user ? String(d.max_uses_per_user) : "",
        applies_to_all: d.applies_to_all,
        applies_to_lifetime: d.applies_to_lifetime,
        applicable_product_ids: d.applicable_product_ids,
        is_active: d.is_active,
        notes: d.notes ?? "",
      });
    } else if (!isEdit) {
      setForm(emptyForm);
    }
  }, [open, isEdit, detail.data]);

  const hasUsage = (detail.data?.used_count ?? 0) > 0;

  const productMap = useMemo(() => {
    const map = new Map<string, string>();
    products.data?.forEach((p) => map.set(p.id, p.title));
    detail.data?.applicable_products?.forEach((p) => map.set(p.id, p.title));
    return map;
  }, [products.data, detail.data]);

  const toggleProduct = (id: string, checked: boolean) => {
    setForm((f) => ({
      ...f,
      applicable_product_ids: checked
        ? [...new Set([...f.applicable_product_ids, id])]
        : f.applicable_product_ids.filter((x) => x !== id),
    }));
  };

  const handleSubmit = async () => {
    const codeTrim = form.code.trim();
    if (!codeTrim) {
      toast({ variant: "destructive", title: "Code is required / الرمز مطلوب" });
      return;
    }
    const numericValue =
      form.kind === "percent"
        ? Number(form.valueStr)
        : Math.round(Number(form.valueStr) * 1000);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      toast({ variant: "destructive", title: "Invalid value / قيمة غير صالحة" });
      return;
    }
    if (form.kind === "percent" && (numericValue < 1 || numericValue > 100)) {
      toast({ variant: "destructive", title: "Percentage must be 1–100" });
      return;
    }
    const minOrderFils = form.min_order_kwd
      ? Math.round(Number(form.min_order_kwd) * 1000)
      : 0;
    if (!Number.isFinite(minOrderFils) || minOrderFils < 0) {
      toast({ variant: "destructive", title: "Invalid minimum order" });
      return;
    }
    if (!form.applies_to_all && form.applicable_product_ids.length === 0) {
      toast({
        variant: "destructive",
        title: "Select at least one product / اختر منتجًا واحدًا على الأقل",
      });
      return;
    }
    const startsIso = toIsoOrNull(form.starts_at);
    const expiresIso = toIsoOrNull(form.expires_at);
    if (startsIso && expiresIso && new Date(expiresIso) <= new Date(startsIso)) {
      toast({ variant: "destructive", title: "Expiry must be after start" });
      return;
    }

    try {
      await upsert.mutateAsync({
        id: discountId,
        code: codeTrim,
        kind: form.kind,
        value: numericValue,
        starts_at: startsIso,
        expires_at: expiresIso,
        min_order_fils: minOrderFils,
        max_total_uses: form.max_total_uses ? Number(form.max_total_uses) : null,
        max_uses_per_user: form.max_uses_per_user ? Number(form.max_uses_per_user) : null,
        applies_to_all: form.applies_to_all,
        applies_to_lifetime: form.applies_to_lifetime,
        applicable_product_ids: form.applicable_product_ids,
        is_active: form.is_active,
        notes: form.notes.trim() || null,
      });
      toast({ title: isEdit ? "Updated / تم التحديث" : "Created / تم الإنشاء" });
      onClose();
    } catch (err) {
      const m = humanizeDiscountError(err);
      toast({ variant: "destructive", title: m.en, description: m.ar });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>
            {isEdit ? "Edit discount / تعديل الخصم" : "New discount / خصم جديد"}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="py-6 space-y-6">
            {hasUsage && (
              <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                This code has been used. Its <b>code, type, value, and lifetime flag</b> can no
                longer change — archive it and create a new <b>unique</b> code instead (codes are
                unique forever, including archived history).
                <br />
                <span dir="rtl">
                  تم استخدام هذا الرمز. لا يمكن تعديل الرمز أو النوع أو القيمة أو خيار الاشتراك مدى
                  الحياة.
                </span>
              </div>
            )}

            <div className="space-y-2">
              <Label>Code / الرمز *</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className="font-mono min-h-[44px]"
                maxLength={40}
                disabled={hasUsage}
              />
              <p className="text-xs text-muted-foreground">
                Codes are globally unique forever, including archived history. Reusing a past code is not allowed.
                <br />
                <span dir="rtl">الرموز فريدة دائمًا بما في ذلك المؤرشفة — لا يمكن إعادة استخدام رمز سابق.</span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type / النوع *</Label>
                <Select
                  value={form.kind}
                  onValueChange={(v) =>
                    setForm({ ...form, kind: v as "percent" | "fixed_fils" })
                  }
                  disabled={hasUsage}
                >
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percentage (%)</SelectItem>
                    <SelectItem value="fixed_fils">Fixed KWD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  Value * {form.kind === "percent" ? "(%)" : "(KWD)"}
                </Label>
                <Input
                  type="number"
                  step={form.kind === "percent" ? "1" : "0.001"}
                  min="0"
                  max={form.kind === "percent" ? "100" : undefined}
                  value={form.valueStr}
                  onChange={(e) => setForm({ ...form, valueStr: e.target.value })}
                  className="min-h-[44px]"
                  disabled={hasUsage}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Starts at / يبدأ في</Label>
                <Input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                  className="min-h-[44px]"
                />
              </div>
              <div className="space-y-2">
                <Label>Expires at / ينتهي في</Label>
                <Input
                  type="datetime-local"
                  value={form.expires_at}
                  onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                  className="min-h-[44px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Min order (KWD)</Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.min_order_kwd}
                  onChange={(e) => setForm({ ...form, min_order_kwd: e.target.value })}
                  className="min-h-[44px]"
                />
              </div>
              <div className="space-y-2">
                <Label>Max total uses</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.max_total_uses}
                  onChange={(e) => setForm({ ...form, max_total_uses: e.target.value })}
                  className="min-h-[44px]"
                />
              </div>
              <div className="space-y-2">
                <Label>Max uses / user</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.max_uses_per_user}
                  onChange={(e) => setForm({ ...form, max_uses_per_user: e.target.value })}
                  className="min-h-[44px]"
                />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Apply to all eligible products</Label>
                  <p className="text-xs text-muted-foreground">
                    يطبق على كل المنتجات المؤهلة
                  </p>
                </div>
                <Switch
                  checked={form.applies_to_all}
                  onCheckedChange={(c) => setForm({ ...form, applies_to_all: c })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Include lifetime product</Label>
                  <p className="text-xs text-muted-foreground">
                    Explicit opt-in for the Jojo lifetime SKU. / تفعيل صريح لمنتج مدى الحياة.
                  </p>
                </div>
                <Switch
                  checked={form.applies_to_lifetime}
                  onCheckedChange={(c) => setForm({ ...form, applies_to_lifetime: c })}
                  disabled={hasUsage}
                />
              </div>

              {!form.applies_to_all && (
                <div className="space-y-2 pt-2 border-t">
                  <Label>Eligible products / المنتجات المؤهلة</Label>
                  <Input
                    placeholder="Search products…"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="min-h-[44px]"
                  />
                  <div className="max-h-48 overflow-y-auto space-y-1 border rounded-md p-2">
                    {products.isLoading ? (
                      <div className="text-xs text-muted-foreground">Loading…</div>
                    ) : (
                      (products.data ?? []).map((p) => (
                        <label
                          key={p.id}
                          className="flex items-center gap-2 text-sm p-1 hover:bg-muted rounded cursor-pointer"
                        >
                          <Checkbox
                            checked={form.applicable_product_ids.includes(p.id)}
                            onCheckedChange={(c) => toggleProduct(p.id, !!c)}
                          />
                          <span className="flex-1 truncate">{p.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {p.product_type} · {formatFils(p.price_fils)}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                  {form.applicable_product_ids.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {form.applicable_product_ids.length} selected:{" "}
                      {form.applicable_product_ids
                        .map((id) => productMap.get(id) ?? id.slice(0, 6))
                        .join(", ")}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive codes are rejected at checkout. / الرموز غير المفعلة تُرفض عند الدفع.
                </p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(c) => setForm({ ...form, is_active: c })}
              />
            </div>

            <div className="space-y-2">
              <Label>Notes (internal)</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={onClose} className="min-h-[44px]">
            Cancel / إلغاء
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={upsert.isPending || (isEdit && detail.isLoading)}
            className="bg-warm-gold hover:bg-warm-gold/90 min-h-[44px]"
          >
            {upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Save / حفظ" : "Create / إنشاء"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
