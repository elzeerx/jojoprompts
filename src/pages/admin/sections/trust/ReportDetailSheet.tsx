import { useMemo, useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/v2/admin/format";
import {
  type AdminReportRow,
  type ReportStatus,
  useUpdateReportStatus,
} from "@/hooks/admin/v2/useAdminReports";
import { Link } from "react-router-dom";

interface Props {
  reportId: string | null;
  rows: AdminReportRow[];
  onOpenChange: (open: boolean) => void;
}

const NEXT_STATUSES: ReportStatus[] = ["open", "reviewing", "resolved", "dismissed"];

function statusTone(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "open") return "destructive";
  if (s === "reviewing") return "default";
  if (s === "resolved") return "secondary";
  return "outline";
}

export default function ReportDetailSheet({ reportId, rows, onOpenChange }: Props) {
  const report = useMemo(
    () => rows.find((r) => r.id === reportId) ?? null,
    [rows, reportId],
  );
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState<ReportStatus | null>(null);
  const mutate = useUpdateReportStatus();

  useEffect(() => {
    setNotes(report?.resolver_notes ?? "");
    setPending(null);
  }, [report?.id, report?.resolver_notes]);

  const handleStatus = async (next: ReportStatus) => {
    if (!report) return;
    setPending(next);
    try {
      await mutate.mutateAsync({
        reportId: report.id,
        status: next,
        notes: notes.trim() ? notes.trim() : null,
      });
      toast({ description: `Marked ${next}` });
      onOpenChange(false);
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: (e as Error).message,
      });
    } finally {
      setPending(null);
    }
  };

  return (
    <Sheet open={!!reportId} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Report detail</SheetTitle>
        </SheetHeader>

        {!report ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : (
          <div className="space-y-4 py-4 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant={statusTone(report.status)}>{report.status}</Badge>
              <Badge variant="outline" className="capitalize">{report.category}</Badge>
            </div>

            <div>
              <div className="text-xs text-muted-foreground">Resource</div>
              <div className="font-medium">{report.resource_title ?? "—"}</div>
              {report.resource_slug && (
                <Link
                  to={`/resources/${report.resource_slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  /resources/{report.resource_slug}
                </Link>
              )}
            </div>

            <div>
              <div className="text-xs text-muted-foreground">Reporter</div>
              <div>{report.reporter_email_masked ?? "—"}</div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground">Details</div>
              <div className="whitespace-pre-wrap rounded-md border bg-muted/30 p-2 text-xs">
                {report.details?.trim() ? report.details : "—"}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>Created<br /><span className="text-foreground">{formatDateTime(report.created_at)}</span></div>
              <div>Updated<br /><span className="text-foreground">{formatDateTime(report.updated_at)}</span></div>
              {report.resolved_at && (
                <div className="col-span-2">
                  Resolved<br /><span className="text-foreground">{formatDateTime(report.resolved_at)}</span>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="resolver-notes" className="block text-xs text-muted-foreground mb-1">
                Resolver notes (optional, max 2000 chars)
              </label>
              <Textarea
                id="resolver-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
                rows={4}
                placeholder="Add context, actions taken, or reason for dismissal"
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {NEXT_STATUSES.filter((s) => s !== report.status).map((s) => (
                <Button
                  key={s}
                  className="min-h-[44px] capitalize"
                  variant={s === "resolved" || s === "dismissed" ? "default" : "outline"}
                  disabled={pending !== null}
                  onClick={() => handleStatus(s)}
                >
                  {pending === s ? "Saving…" : `Mark ${s}`}
                </Button>
              ))}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
