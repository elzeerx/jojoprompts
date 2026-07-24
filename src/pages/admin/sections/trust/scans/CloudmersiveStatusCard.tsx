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
        title: "Configured",
        hint: "Credential validity is verified on the first real scan. Cloudmersive Virus Scan (advanced) will scan uploaded package files with strict content policies.",
      };
    case "no_api_key":
      return {
        title: "Not configured",
        hint: "Add CLOUDMERSIVE_API_KEY in Supabase Dashboard → Edge Functions → Secrets. Never prefix it with VITE_ and never place it in Lovable or frontend code.",
      };
    case "no_worker_secret":
      return {
        title: "Configuration incomplete",
        hint: "Add PACKAGE_SCAN_WORKER_SECRET in Supabase Dashboard → Edge Functions → Secrets (any strong random string) so the control function can invoke the private worker.",
      };
  }
}

function tone(r: ScanReadiness): "default" | "secondary" | "destructive" {
  if (r.ready) return "default";
  return "secondary";
}

function Icon({ ready, configured }: { ready: boolean; configured: boolean }) {
  if (ready) return <ShieldCheck className="h-5 w-5 text-emerald-600" />;
  if (!configured) return <ShieldOff className="h-5 w-5 text-muted-foreground" />;
  return <ShieldAlert className="h-5 w-5 text-amber-600" />;
}

export default function CloudmersiveStatusCard() {
  const q = useScanProviderStatus();
  const readiness: ScanReadiness = q.data?.readiness ?? {
    configured: false,
    ready: false,
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
                  Cloudmersive Virus Scan
                </span>
                <Badge variant={tone(readiness)} className="break-words">
                  {readiness.ready ? "Configured" : "Not configured"}
                </Badge>
                <Badge variant="outline" className="break-words">
                  Advanced scan policy
                </Badge>
              </div>
              <div className="text-sm font-medium break-words">
                {copy.title}
              </div>
              <p className="text-sm text-muted-foreground break-words">
                {copy.hint}
              </p>
              <p className="text-xs text-muted-foreground break-words">
                Credential validity is verified on the first real scan; no
                readiness call is made against the provider.
              </p>
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
