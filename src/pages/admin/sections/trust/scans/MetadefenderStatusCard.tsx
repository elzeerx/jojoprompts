import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, ShieldCheck, ShieldAlert, ShieldOff } from "lucide-react";
import {
  useScanProviderStatus,
  type ScanReadiness,
  type ScanReadinessReason,
} from "@/hooks/admin/v2/useScanProvider";

function reasonCopy(r: ScanReadinessReason): { title: string; hint: string } {
  switch (r) {
    case "ok":
      return {
        title: "Ready for private scanning",
        hint: "Private Processing enforced. Uploads stay isolated to your paid organization.",
      };
    case "no_api_key":
      return {
        title: "Not configured",
        hint: "Add Supabase secret METADEFENDER_API_KEY (a paid OPSWAT MetaDefender Cloud API v4 key with Private Scanning enforced).",
      };
    case "no_worker_secret":
      return {
        title: "Configuration incomplete",
        hint: "Add Supabase secret PACKAGE_SCAN_WORKER_SECRET (any strong random string) so the control function can invoke the private worker.",
      };
    case "provider_unreachable":
      return {
        title: "Provider unreachable",
        hint: "MetaDefender Cloud did not respond to the account check. Try again shortly.",
      };
    case "provider_unauthorized":
      return {
        title: "API key rejected",
        hint: "Rotate METADEFENDER_API_KEY. Ensure the key belongs to a paid organization with Private Scanning enforced.",
      };
    case "not_paid_account":
      return {
        title: "Paid account required",
        hint: "Private scanning requires a paid MetaDefender Cloud plan (paid_user=1).",
      };
    case "upload_size_too_small":
      return {
        title: "25 MB upload allowance required",
        hint: "Increase the plan's per-file upload limit to at least 25 MB.",
      };
    case "no_scan_engines":
      return {
        title: "No scan engines available",
        hint: "The plan reports scan_with=none. Enable engines in your MetaDefender Cloud plan.",
      };
    case "private_scan_not_enforced":
      return {
        title: "Private Scanning required",
        hint: "Turn on Private Scanning enforcement at the API key or organization level in MetaDefender Cloud.",
      };
  }
}

function tone(r: ScanReadiness): "default" | "secondary" | "destructive" {
  if (r.ready) return "default";
  if (r.reason === "no_api_key" || r.reason === "no_worker_secret") {
    return "secondary";
  }
  return "destructive";
}

function Icon({ ready, configured }: { ready: boolean; configured: boolean }) {
  if (ready) return <ShieldCheck className="h-5 w-5 text-emerald-600" />;
  if (!configured) return <ShieldOff className="h-5 w-5 text-muted-foreground" />;
  return <ShieldAlert className="h-5 w-5 text-amber-600" />;
}

export default function MetadefenderStatusCard() {
  const q = useScanProviderStatus();
  const readiness: ScanReadiness = q.data?.readiness ?? {
    configured: false,
    ready: false,
    max_upload_mb: null,
    private_scan_enforced: false,
    license_ready: false,
    reason: "no_api_key",
  };
  const copy = reasonCopy(readiness.reason);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 min-w-0">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="shrink-0">
              <Icon
                ready={readiness.ready}
                configured={readiness.configured}
              />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="font-semibold break-words">
                  MetaDefender Cloud
                </span>
                <Badge variant={tone(readiness)} className="break-words">
                  {readiness.ready
                    ? "Ready"
                    : readiness.configured
                    ? "Attention"
                    : "Not configured"}
                </Badge>
                <Badge variant="outline" className="break-words">
                  Private Processing required
                </Badge>
                <Badge variant="outline" className="break-words">
                  25 MB minimum
                </Badge>
              </div>
              <div className="text-sm font-medium break-words">
                {copy.title}
              </div>
              <p className="text-sm text-muted-foreground break-words">
                {copy.hint}
              </p>
              <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-1">
                <span className="break-words">
                  License: {readiness.license_ready ? "paid" : "—"}
                </span>
                <span className="break-words">
                  Max upload:{" "}
                  {readiness.max_upload_mb != null
                    ? `${readiness.max_upload_mb} MB`
                    : "—"}
                </span>
                <span className="break-words">
                  Private Scanning:{" "}
                  {readiness.private_scan_enforced
                    ? "enforced"
                    : "not enforced"}
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="min-h-[44px] min-w-[44px] shrink-0"
            onClick={() => q.refetch()}
            aria-label="Recheck provider status"
            disabled={q.isFetching}
          >
            <RefreshCw
              className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
        {!readiness.ready && (
          <p className="text-xs text-muted-foreground break-words">
            Scanning actions are disabled until the checks above pass. No scan
            will run and no file will leave storage.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

