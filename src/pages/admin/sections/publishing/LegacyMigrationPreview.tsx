import { RefreshCw, ShieldAlert, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMigrationPreview } from "@/hooks/admin/v2/useAdminCommerce";

function fmtInt(n: unknown): string {
  const v = typeof n === "number" ? n : Number(n ?? 0);
  return Number.isFinite(v) ? v.toLocaleString() : "0";
}
function fmtFilsAsKwd(fils: unknown): string {
  const v = typeof fils === "number" ? fils : Number(fils ?? 0);
  if (!Number.isFinite(v)) return "—";
  return `${(v / 1000).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KWD`;
}

function Stat({ label, labelAr, value, hint }: { label: string; labelAr?: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">
        {label}{labelAr ? ` / ${labelAr}` : ""}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export default function LegacyMigrationPreview() {
  const q = useMigrationPreview();

  if (q.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </div>
    );
  }

  if (q.isError) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Error / خطأ: {(q.error as Error).message}
      </div>
    );
  }

  const d = q.data!;
  const upay = d.transactions_upayments as {
    ambiguity_note?: string;
    total_count?: number;
    completed_count?: number;
    raw_value_total?: number;
    interpretation_A_values_as_KWD?: { conversion?: string; total_fils?: number; completed_fils?: number };
    interpretation_B_values_as_legacy_USD?: { conversion?: string; total_fils?: number; completed_fils?: number };
    duplicate_provider_reference_groups?: number;
  };
  const paypal = d.transactions_paypal as {
    total_count?: number;
    by_status?: Array<{ status: string; n: number; usd_total: number; fils_total: number }>;
    proposed_credit_fils_completed?: number;
    zero_amount_count?: number;
    missing_subscription_link?: number;
    duplicate_provider_reference_groups?: number;
  };

  return (
    <TooltipProvider>
      <div className="space-y-6" dir="ltr">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Legacy access migration preview / معاينة ترحيل الوصول
            </h1>
            <p className="text-sm text-muted-foreground">
              Read-only reconciliation. No customer entitlements, credits, or V1 data are changed by opening this page.
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="min-h-[44px] min-w-[44px]"
            onClick={() => q.refetch()}
            aria-label="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Execution status banner */}
        <Card className="border-warning bg-warning/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 text-warning-foreground" />
              <div className="text-sm">
                <div className="font-medium">
                  Execute migration is disabled / تنفيذ الترحيل معطّل
                </div>
                <div className="text-muted-foreground">
                  Fixed conversion rate: <strong>1 USD = {d.conversion_rate_fils_per_usd} fils</strong>. Blockers:{" "}
                  {d.execution_blockers.length === 0
                    ? "none — awaiting scope sign-off"
                    : d.execution_blockers.join(", ")}.
                </div>
              </div>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button disabled className="min-h-[44px]">
                    <Lock className="mr-2 h-4 w-4" />
                    Execute migration
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                Intentionally disabled. No execution endpoint is exposed until an admin resolves the UPayments currency policy.
              </TooltipContent>
            </Tooltip>
          </CardContent>
        </Card>

        {/* Catalog reconciliation */}
        <Card>
          <CardHeader><CardTitle className="text-base">Catalog / الفهرس</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="Legacy prompts" labelAr="ملاحظات قديمة" value={fmtInt(d.catalog.legacy_prompt_count)} />
            <Stat label="Matched V2 resources" labelAr="موارد مطابقة" value={fmtInt(d.catalog.matched_resource_count)} />
            <Stat label="Legacy versions" value={fmtInt(d.catalog.legacy_version_count)} />
            <Stat label="Legacy products" value={fmtInt(d.catalog.legacy_product_count)} />
            <Stat label="Unmatched legacy" value={fmtInt(d.catalog.unmatched_legacy_prompt_count)} />
          </CardContent>
        </Card>

        {/* Collections */}
        <Card>
          <CardHeader><CardTitle className="text-base">Collection classification / تصنيف المجموعات</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="ChatGPT prompts" labelAr="مجموعة ChatGPT" value={fmtInt(d.collections.chatgpt_prompts)} />
            <Stat label="Midjourney prompts" labelAr="مجموعة Midjourney" value={fmtInt(d.collections.midjourney_prompts)} />
            <Stat
              label="Unmatched / ambiguous"
              labelAr="غير مطابق"
              value={fmtInt(d.collections.unmatched_or_ambiguous)}
              hint="These will NOT be included in any collection grant — review required."
            />
          </CardContent>
        </Card>

        {/* Unmatched sample */}
        {d.unmatched_sample.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Unmatched sample (first 25)</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Slug</TableHead>
                      <TableHead>Resource type</TableHead>
                      <TableHead>Legacy prompt_type</TableHead>
                      <TableHead>Resource ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.unmatched_sample.map((r) => (
                      <TableRow key={r.resource_id}>
                        <TableCell className="text-xs">{r.slug}</TableCell>
                        <TableCell><Badge variant="outline">{r.resource_type}</Badge></TableCell>
                        <TableCell className="text-xs">{r.legacy_prompt_type ?? "—"}</TableCell>
                        <TableCell className="font-mono text-[11px]">{r.resource_id.slice(0, 8)}…</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Subscriptions */}
        <Card>
          <CardHeader><CardTitle className="text-base">Legacy subscriptions / الاشتراكات القديمة</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
              <Stat label="Total subscriptions" value={fmtInt(d.subscriptions.total_subscriptions)} />
              <Stat label="Distinct users" value={fmtInt(d.subscriptions.distinct_users)} />
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tier</TableHead>
                    <TableHead>Lifetime</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Count</TableHead>
                    <TableHead>Expired</TableHead>
                    <TableHead>Active/Perpetual</TableHead>
                    <TableHead>Proposed scope</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.subscriptions.rows.map((r, i) => (
                    <TableRow key={`${r.tier}-${r.status}-${i}`}>
                      <TableCell><Badge variant="outline">{r.tier}</Badge></TableCell>
                      <TableCell>{r.is_lifetime ? "Yes" : "No"}</TableCell>
                      <TableCell><Badge variant="secondary">{r.status}</Badge></TableCell>
                      <TableCell className="tabular-nums">{fmtInt(r.count)}</TableCell>
                      <TableCell className="tabular-nums">{fmtInt(r.expired)}</TableCell>
                      <TableCell className="tabular-nums">{fmtInt(r.active_or_perpetual)}</TableCell>
                      <TableCell><Badge>{r.proposed_scope}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {d.subscriptions.rows.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="h-16 text-center text-sm text-muted-foreground">No legacy subscriptions</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* PayPal */}
        <Card>
          <CardHeader><CardTitle className="text-base">PayPal transactions (USD → fils @ {d.conversion_rate_fils_per_usd})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Total" value={fmtInt(paypal.total_count)} />
              <Stat label="Zero amount" value={fmtInt(paypal.zero_amount_count)} />
              <Stat label="Missing subscription link" value={fmtInt(paypal.missing_subscription_link)} />
              <Stat label="Duplicate provider refs" value={fmtInt(paypal.duplicate_provider_reference_groups)} />
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Count</TableHead>
                    <TableHead>USD total</TableHead>
                    <TableHead>fils total</TableHead>
                    <TableHead>Equivalent KWD</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(paypal.by_status ?? []).map((r) => (
                    <TableRow key={r.status}>
                      <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                      <TableCell className="tabular-nums">{fmtInt(r.n)}</TableCell>
                      <TableCell className="tabular-nums">{Number(r.usd_total ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="tabular-nums">{fmtInt(r.fils_total)}</TableCell>
                      <TableCell className="tabular-nums">{fmtFilsAsKwd(r.fils_total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="rounded-md border bg-muted/40 p-3 text-xs">
              Proposed credit for completed payments (pre-cap):{" "}
              <strong>{fmtInt(paypal.proposed_credit_fils_completed)}</strong> fils
              {" · "}{fmtFilsAsKwd(paypal.proposed_credit_fils_completed)}
            </div>
          </CardContent>
        </Card>

        {/* UPayments — ambiguous */}
        <Card className="border-warning">
          <CardHeader><CardTitle className="text-base">UPayments transactions — currency ambiguous</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border border-warning bg-warning/5 p-3 text-xs">
              {upay.ambiguity_note ?? "Ambiguous currency; do not choose an interpretation here."}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label="Total" value={fmtInt(upay.total_count)} />
              <Stat label="Completed" value={fmtInt(upay.completed_count)} />
              <Stat label="Duplicate provider refs" value={fmtInt(upay.duplicate_provider_reference_groups)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-md border p-3">
                <div className="text-xs font-semibold">Interpretation A — values as KWD</div>
                <div className="text-[11px] text-muted-foreground mb-2">{upay.interpretation_A_values_as_KWD?.conversion}</div>
                <div>Completed fils: <strong className="tabular-nums">{fmtInt(upay.interpretation_A_values_as_KWD?.completed_fils)}</strong></div>
                <div>Total fils: <strong className="tabular-nums">{fmtInt(upay.interpretation_A_values_as_KWD?.total_fils)}</strong></div>
                <div className="text-xs text-muted-foreground">≈ {fmtFilsAsKwd(upay.interpretation_A_values_as_KWD?.completed_fils)} completed</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs font-semibold">Interpretation B — values as legacy USD</div>
                <div className="text-[11px] text-muted-foreground mb-2">{upay.interpretation_B_values_as_legacy_USD?.conversion}</div>
                <div>Completed fils: <strong className="tabular-nums">{fmtInt(upay.interpretation_B_values_as_legacy_USD?.completed_fils)}</strong></div>
                <div>Total fils: <strong className="tabular-nums">{fmtInt(upay.interpretation_B_values_as_legacy_USD?.total_fils)}</strong></div>
                <div className="text-xs text-muted-foreground">≈ {fmtFilsAsKwd(upay.interpretation_B_values_as_legacy_USD?.completed_fils)} completed</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Proposed entitlements + credit */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Proposed entitlements</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Stat label="Library users" value={fmtInt(d.proposed_entitlements.library_users)} />
              <Stat label="Collection users" value={fmtInt(d.proposed_entitlements.collection_users)} />
              <Stat label="Estimated active" value={fmtInt(d.proposed_entitlements.estimated_active_entitlements)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Proposed lifetime credit</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Stat label="Users with credit" value={fmtInt(d.proposed_lifetime_credit.users_with_credit)} />
              <Stat label="Users capped @ threshold" value={fmtInt(d.proposed_lifetime_credit.users_capped_at_threshold)} />
              <Stat
                label="Total credit"
                value={fmtInt(d.proposed_lifetime_credit.total_credit_fils)}
                hint={`≈ ${fmtFilsAsKwd(d.proposed_lifetime_credit.total_credit_fils)}`}
              />
              <Stat label="Threshold" value={fmtInt(d.proposed_lifetime_credit.threshold_fils)} hint="fils" />
            </CardContent>
          </Card>
        </div>

        {/* Anomalies */}
        <Card>
          <CardHeader><CardTitle className="text-base">Anomalies / تنبيهات</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="Zero-amount PayPal completed" value={fmtInt(d.anomalies.zero_amount_paypal_completed)} />
            <Stat label="Transactions w/o subscription" value={fmtInt(d.anomalies.transactions_without_subscription)} />
            <Stat label="Subscriptions w/o plan" value={fmtInt(d.anomalies.subscriptions_without_plan)} />
          </CardContent>
        </Card>

        <div className="text-xs text-muted-foreground">
          Generated at {d.generated_at} · Read-only preview · No execution endpoint exposed.
        </div>
      </div>
    </TooltipProvider>
  );
}
