import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useAdminDiscount, type DiscountStatus } from "@/hooks/admin/v2/useAdminDiscounts";
import { formatFils, formatDateTime } from "@/lib/v2/admin/format";

interface Props {
  discountId: string | null;
  onClose: () => void;
  onEdit: (id: string) => void;
}

const STATUS_LABEL: Record<DiscountStatus, string> = {
  active: "Active / نشط",
  scheduled: "Scheduled / مجدول",
  expired: "Expired / منتهي",
  exhausted: "Exhausted / مستنفد",
  inactive: "Inactive / غير مفعل",
  archived: "Archived / مؤرشف",
};

export function DiscountDetailSheet({ discountId, onClose, onEdit }: Props) {
  const query = useAdminDiscount(discountId);
  const d = query.data;

  return (
    <Sheet open={!!discountId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-mono">{d?.code ?? "Loading…"}</SheetTitle>
        </SheetHeader>

        {query.isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : query.isError || !d ? (
          <p className="text-destructive mt-6">Failed to load / فشل التحميل</p>
        ) : (
          <div className="space-y-5 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{STATUS_LABEL[d.status]}</Badge>
              {!d.is_active && <Badge variant="outline">Inactive</Badge>}
              {d.applies_to_lifetime && <Badge variant="outline">Lifetime opt-in</Badge>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Row label="Type" value={d.kind === "percent" ? "Percentage" : "Fixed KWD"} />
              <Row
                label="Value"
                value={
                  d.kind === "percent" ? `${d.value}%` : `${formatFils(d.value)}`
                }
              />
              <Row label="Min order" value={formatFils(d.min_order_fils)} />
              <Row
                label="Scope"
                value={d.applies_to_all ? "All products" : `${d.applicable_products.length} products`}
              />
              <Row label="Starts" value={formatDateTime(d.starts_at)} />
              <Row label="Expires" value={formatDateTime(d.expires_at)} />
              <Row
                label="Total uses"
                value={`${d.used_count}${d.max_total_uses ? ` / ${d.max_total_uses}` : ""}`}
              />
              <Row
                label="Per-user cap"
                value={d.max_uses_per_user ? String(d.max_uses_per_user) : "—"}
              />
              <Row label="Consumed (paid)" value={String(d.consumed_count)} />
              <Row label="Updated" value={formatDateTime(d.updated_at)} />
              <Row label="Created" value={formatDateTime(d.created_at)} />
              {d.archived_at && <Row label="Archived" value={formatDateTime(d.archived_at)} />}
            </div>

            {!d.applies_to_all && d.applicable_products.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Eligible products</h4>
                <ul className="border rounded-md divide-y max-h-56 overflow-y-auto">
                  {d.applicable_products.map((p) => (
                    <li key={p.id} className="p-2 flex justify-between text-xs">
                      <span className="truncate">{p.title}</span>
                      <span className="text-muted-foreground">
                        {p.product_type} · {formatFils(p.price_fils)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {d.notes && (
              <div>
                <h4 className="font-semibold mb-1">Notes</h4>
                <p className="text-muted-foreground whitespace-pre-wrap">{d.notes}</p>
              </div>
            )}

            <div className="flex gap-2 pt-3 border-t">
              {d.status !== "archived" && (
                <Button
                  onClick={() => onEdit(d.id)}
                  className="bg-warm-gold hover:bg-warm-gold/90 min-h-[44px]"
                >
                  Edit / تعديل
                </Button>
              )}
              <Button variant="outline" onClick={onClose} className="min-h-[44px]">
                Close / إغلاق
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
