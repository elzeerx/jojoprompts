import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import { useAdminPaymentEventDetail } from "@/hooks/admin/v2/useAdminCommerce";
import { formatFils, formatDateTime, statusTone, bi, BILINGUAL } from "@/lib/v2/admin/format";

interface Props {
  eventId: string | null;
  onOpenChange: (open: boolean) => void;
}

const SAFE_KEY_ALLOWLIST = new Set([
  "orderId", "trackId", "sessionId", "merchantReference", "providerOrderId",
  "status", "amount", "amount_fils", "currency", "reason", "reference",
  "refundReason", "refundReference", "provider_refund_order_id",
  "verified", "captured_at", "authorized_at",
]);

function renderPayload(payload: unknown): React.ReactNode {
  if (!payload || typeof payload !== "object") return <span className="text-muted-foreground">—</span>;
  const obj = payload as Record<string, unknown>;
  const entries = Object.entries(obj).filter(([k]) => SAFE_KEY_ALLOWLIST.has(k));
  if (entries.length === 0) {
    return <span className="text-muted-foreground">No allowlisted keys in stored payload.</span>;
  }
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
      {entries.map(([k, v]) => (
        <div key={k} className="text-xs">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="font-mono break-all">{typeof v === "string" || typeof v === "number" ? String(v) : JSON.stringify(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

interface DetailResp {
  event: {
    id: string;
    order_id: string | null;
    provider: string;
    event_type: string;
    external_event_id: string | null;
    amount_fils: number | null;
    currency: string | null;
    received_at: string;
    sanitized_payload: unknown;
  };
  related_rejections: Array<{ id: string; action: string; metadata: unknown; created_at: string }>;
}

export function PaymentEventDetailDialog({ eventId, onOpenChange }: Props) {
  const query = useAdminPaymentEventDetail(eventId);
  const data = query.data as unknown as DetailResp | undefined;

  return (
    <Dialog open={!!eventId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payment event / حدث دفع</DialogTitle>
        </DialogHeader>

        {query.isLoading && <div className="space-y-2 mt-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>}
        {query.isError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive mt-4">
            {bi("error")}: {(query.error as Error).message}
          </div>
        )}

        {data && (
          <div className="space-y-4 mt-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant={statusTone(data.event.event_type)}>{data.event.event_type}</Badge>
              <span className="text-muted-foreground">{data.event.provider}</span>
              <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(data.event.received_at)}</span>
            </div>
            <div className="rounded-md border p-3 text-xs">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div><div className="text-muted-foreground">External event ID</div><div className="font-mono break-all">{data.event.external_event_id ?? "—"}</div></div>
                <div><div className="text-muted-foreground">Order</div><div className="font-mono break-all">{data.event.order_id ?? "—"}</div></div>
                <div><div className="text-muted-foreground">Amount</div><div>{typeof data.event.amount_fils === "number" ? formatFils(data.event.amount_fils) : "—"}</div></div>
              </div>
            </div>
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sanitized payload (allowlisted keys only)</h4>
              <div className="rounded-md border bg-muted/30 p-3">
                {renderPayload(data.event.sanitized_payload)}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{BILINGUAL.immutable.en}</p>
            </div>
            {data.related_rejections.length > 0 && (
              <div>
                <h4 className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" /> Verification rejections on this order
                </h4>
                <ul className="space-y-2">
                  {data.related_rejections.map((r) => (
                    <li key={r.id} className="rounded border border-destructive/30 bg-destructive/5 p-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono">{r.action}</span>
                        <span className="text-muted-foreground">{formatDateTime(r.created_at)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
