import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Plug,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  Info,
  KeyRound,
  Boxes,
  CreditCard,
  Mail,
  ShieldAlert,
  Sparkles,
  Network,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDateTime } from "@/lib/v2/admin/format";
import { useAdminIntegrationsSettingsStatus } from "@/hooks/admin/v2/useAdminIntegrationsSettings";
import {
  INTEGRATIONS_SECRETS_URL,
  integrationDisplayName,
  integrationStatus,
  purposeLabel,
  summarize,
  type Integration,
  type IntegrationId,
  type StatusTone,
} from "@/lib/v2/admin/integrationsSettings";

function toneClass(tone: StatusTone): string {
  switch (tone) {
    case "ok": return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "warn": return "bg-amber-100 text-amber-800 border-amber-200";
    case "danger": return "bg-red-100 text-red-800 border-red-200";
    case "info":
    default: return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function iconFor(id: IntegrationId) {
  switch (id) {
    case "upayments": return CreditCard;
    case "resend": return Mail;
    case "cloudmersive": return ShieldAlert;
    case "lovable_ai": return Sparkles;
    case "jojoprompts_mcp": return Network;
  }
}

function actionLabelFor(id: IntegrationId): string {
  switch (id) {
    case "upayments": return "Open payment settings";
    case "resend": return "Open email settings";
    case "cloudmersive": return "Open package scans";
    case "lovable_ai": return "Open AI Studio";
    case "jojoprompts_mcp": return "";
  }
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-2.5 min-h-[56px] flex flex-col justify-center">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium break-words">{value}</div>
    </div>
  );
}

function facts(i: Integration): { label: string; value: string }[] {
  switch (i.id) {
    case "upayments":
      return [
        { label: "Purpose", value: purposeLabel(i.purpose) },
        { label: "Provider enabled", value: i.enabled ? "Yes" : "No" },
        {
          label: "Environment",
          value: i.environment === "not_configured"
            ? "Not configured"
            : i.environment === "sandbox" ? "Sandbox" : "Production",
        },
      ];
    case "resend":
      return [
        { label: "Purpose", value: purposeLabel(i.purpose) },
        { label: "Sender", value: i.sender_address },
        { label: "Domain", value: i.domain },
      ];
    case "cloudmersive":
      return [
        { label: "Purpose", value: purposeLabel(i.purpose) },
        { label: "API key", value: i.api_key_configured ? "Configured" : "Missing" },
        { label: "Worker secret", value: i.worker_secret_configured ? "Configured" : "Missing" },
      ];
    case "lovable_ai":
      return [
        { label: "Purpose", value: purposeLabel(i.purpose) },
        { label: "Services", value: i.application_services.join(", ") },
      ];
    case "jojoprompts_mcp":
      return [
        { label: "Purpose", value: purposeLabel(i.purpose) },
        { label: "Auth", value: "Supabase OAuth" },
        { label: "Contract version", value: i.contract_version },
        { label: "Tools", value: i.tools.join(", ") },
      ];
  }
}

const BOUNDARIES: { key: string; label: string; checked: boolean }[] = [
  { key: "server_config", label: "Required server configuration present", checked: true },
  { key: "provider_uptime", label: "Provider uptime / availability", checked: false },
  { key: "account_balance", label: "Account balance, quota, or credits", checked: false },
  { key: "dns_verification", label: "DNS / SPF / DKIM verification", checked: false },
  { key: "deployment_status", label: "Edge Function deployment status", checked: false },
  { key: "runtime_health", label: "End-to-end runtime health", checked: false },
];

export default function IntegrationsPage() {
  const q = useAdminIntegrationsSettingsStatus();
  const summary = useMemo(() => (q.data ? summarize(q.data) : null), [q.data]);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Plug className="h-6 w-6" aria-hidden />
            Integrations
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Read-only inventory of the third-party integrations JojoPrompts
            uses. Shows only whether the required server configuration is
            present. Secret values are never displayed.
          </p>
          <div className="text-xs text-muted-foreground mt-2">
            Last checked:{" "}
            <span className="break-words">
              {q.data ? formatDateTime(q.data.as_of) : "—"}
            </span>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => void q.refetch()}
          disabled={q.isFetching}
          className="min-h-[44px] w-full sm:w-auto"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {q.isError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Integration status unavailable</AlertTitle>
          <AlertDescription>
            We could not load the integration inventory. Try Refresh, or open
            individual settings pages below.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {q.isLoading || !summary ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[68px] w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Fact label="Total integrations" value={String(summary.total)} />
              <Fact label="Configured" value={String(summary.configured)} />
              <Fact label="Needs configuration" value={String(summary.needs_configuration)} />
              <Fact label="Contract-only" value={String(summary.contract_only)} />
            </div>
          )}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Configuration presence only</AlertTitle>
            <AlertDescription>
              This page reports only whether required credentials and
              configuration are present. Provider uptime, account balance or
              quota, DNS verification, deployment status, and end-to-end
              runtime health are not probed.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Integration cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {q.isLoading &&
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[220px] w-full rounded-lg" />
          ))}
        {q.data?.integrations.map((i) => {
          const st = integrationStatus(i);
          const Icon = iconFor(i.id);
          const label = actionLabelFor(i.id);
          return (
            <Card key={i.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <CardTitle className="text-base flex items-center gap-2 min-w-0 break-words">
                    <Icon className="h-5 w-5 shrink-0" aria-hidden />
                    <span className="break-words">{integrationDisplayName(i.id)}</span>
                  </CardTitle>
                  <Badge variant="outline" className={`${toneClass(st.tone)} shrink-0`}>
                    {st.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {facts(i).map((f) => (
                    <Fact key={f.label} label={f.label} value={f.value} />
                  ))}
                </div>

                {i.id === "jojoprompts_mcp" && (
                  <div className="rounded-md border bg-muted/40 p-3">
                    <div className="text-xs text-muted-foreground mb-1">Endpoint</div>
                    <code className="block text-xs break-all whitespace-pre-wrap font-mono">
                      {i.endpoint}
                    </code>
                    <div className="text-xs text-muted-foreground mt-2">
                      Runtime deployment / health is not checked here.
                    </div>
                  </div>
                )}

                {i.id !== "jojoprompts_mcp" && (
                  <div className="mt-auto">
                    <Button
                      asChild
                      variant="outline"
                      className="w-full min-h-[44px] justify-center"
                    >
                      <Link to={i.specialist_route}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        {label}
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Secret management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-5 w-5" aria-hidden />
            Secret management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            All integration credentials (API keys, worker secrets, provider
            tokens) are managed in Supabase Edge Function Secrets. Values are
            never displayed in this admin. Rotating or adding a secret is done
            from the Supabase dashboard.
          </p>
          <Button
            asChild
            variant="outline"
            className="w-full sm:w-auto min-h-[44px]"
          >
            <a
              href={INTEGRATIONS_SECRETS_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Supabase Edge Function Secrets
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Verification boundaries */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" aria-hidden />
            Verification boundaries
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {BOUNDARIES.map((b) => (
              <li
                key={b.key}
                className="flex items-start gap-2 text-sm break-words"
              >
                <Badge
                  variant="outline"
                  className={`shrink-0 ${
                    b.checked
                      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                      : "bg-slate-100 text-slate-700 border-slate-200"
                  }`}
                >
                  {b.checked ? "Checked" : "Not checked"}
                </Badge>
                <span className="break-words">{b.label}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Related admin surfaces */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Boxes className="h-5 w-5" aria-hidden />
            Related admin surfaces
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              { to: "/admin/settings/payments", label: "Payment settings" },
              { to: "/admin/settings/email", label: "Email settings" },
              { to: "/admin/settings/storage", label: "Storage settings" },
              { to: "/admin/trust/scans", label: "Package scans" },
            ].map((l) => (
              <Button
                key={l.to}
                asChild
                variant="ghost"
                className="justify-start min-h-[44px] w-full"
              >
                <Link to={l.to}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {l.label}
                </Link>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
