import { Copy, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/v2/admin/format";
import { resolveEntityLink, shortId } from "@/lib/v2/admin/auditDeepLinks";
import { useAdminAuditEvent } from "@/hooks/admin/v2/useAdminAuditLog";
import { toast } from "@/hooks/use-toast";

interface Props {
  eventId: string | null;
  onOpenChange: (open: boolean) => void;
}

export default function AuditEventDetailSheet({ eventId, onOpenChange }: Props) {
  const q = useAdminAuditEvent(eventId);
  const ev = q.data ?? null;
  const link = ev ? resolveEntityLink(ev.entity_type, ev.entity_id) : null;

  const copy = async (label: string, value: string | null) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast({ description: `${label} copied` });
    } catch {
      toast({ description: "Copy failed", variant: "destructive" });
    }
  };

  return (
    <Sheet open={!!eventId} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Audit event</SheetTitle>
          <SheetDescription>
            Read-only detail for a single activity event.
          </SheetDescription>
        </SheetHeader>

        {q.isLoading ? (
          <div className="mt-4 space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : !ev ? (
          <div className="mt-6 text-sm text-muted-foreground">No event selected.</div>
        ) : (
          <div className="mt-4 space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{ev.actor_type}</Badge>
              <Badge>{ev.action}</Badge>
              <Badge variant="secondary">{ev.entity_type}</Badge>
            </div>

            <dl className="grid grid-cols-3 gap-x-3 gap-y-2">
              <dt className="text-muted-foreground">When</dt>
              <dd className="col-span-2 break-words">{formatDateTime(ev.created_at)}</dd>

              <dt className="text-muted-foreground">Actor</dt>
              <dd className="col-span-2 break-words">
                {ev.actor_email_masked ?? ev.actor_username ?? "—"}
                {ev.actor_user_id && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({shortId(ev.actor_user_id)})
                  </span>
                )}
              </dd>

              <dt className="text-muted-foreground">Entity id</dt>
              <dd className="col-span-2 break-all font-mono text-xs">
                {ev.entity_id ?? "—"}
                {ev.entity_id && (
                  <Button
                    variant="ghost" size="icon"
                    className="ml-1 h-7 w-7"
                    aria-label="Copy entity id"
                    onClick={() => copy("Entity id", ev.entity_id)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                )}
              </dd>

              <dt className="text-muted-foreground">Event id</dt>
              <dd className="col-span-2 break-all font-mono text-xs">
                {ev.id}
                <Button
                  variant="ghost" size="icon"
                  className="ml-1 h-7 w-7"
                  aria-label="Copy event id"
                  onClick={() => copy("Event id", ev.id)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </dd>

              <dt className="text-muted-foreground">IP</dt>
              <dd className="col-span-2 break-all font-mono text-xs">
                {ev.ip_address ?? "—"}
              </dd>
            </dl>

            {link && (
              <Button asChild variant="outline" className="min-h-[44px] w-full">
                <Link to={link}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open {ev.entity_type}
                </Link>
              </Button>
            )}

            <div>
              <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                Metadata
              </div>
              <pre className="max-h-72 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
{JSON.stringify(ev.metadata ?? {}, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
