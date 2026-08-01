/**
 * V2 Resource JSON Importer
 * -------------------------
 * Accepts a single object or array of V2 resource drafts (paste or .json upload),
 * validates against the same publisher contract as ResourcePublisher, and hands
 * each valid item off to the authorized `save_admin_resource_draft` RPC.
 *
 * Contract:
 *   - Supported V2 resource types: skill, automation, prompt, prompt_pack, image_style, bundle.
 *   - Legacy prompt JSON ({ title, content, description?, tags? } with no `type`) is
 *     deterministically mapped into a V2 `prompt` draft. No silent field drops.
 *   - Privileged/server-owned fields (owner, is_published, current_version_id,
 *     entitlement*, scan_state, published_at, lifecycle, etc.) are rejected as
 *     row-level errors. Client-supplied `id`/`resource_id` are always dropped.
 *   - Prices persist as integer fils in the payload sent to the RPC.
 *   - Never auto-publishes. Never persists invalid rows. Never creates empty drafts.
 *     The user must explicitly click "Import valid drafts".
 *   - Never touches the legacy prompts table or the legacy prompt service surface.
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle, Check, ChevronLeft, FileJson, Sparkles, Upload,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { createLogger } from "@/utils/logging";
import {
  buildDraftPayload,
  RowValidation,
  V2_SAMPLE_JSON,
  validateRow,
} from "./jsonResourceImporterContract";

const logger = createLogger("V2_JSON_RESOURCE_IMPORTER");


// ── Component ──────────────────────────────────────────────────────────────
type ImportResult = { index: number; title: string; status: "ok" | "error"; message?: string };

export default function JsonResourceImporter() {
  const { dir, language } = useLanguage();
  const isAr = language === "ar";
  const [raw, setRaw] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [rows, setRows] = useState<RowValidation[]>([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);

  const summary = useMemo(() => {
    const total = rows.length;
    const valid = rows.filter((r) => r.ok).length;
    const invalid = total - valid;
    const legacy = rows.filter((r) => r.fromLegacy).length;
    return { total, valid, invalid, legacy };
  }, [rows]);

  const handleValidate = () => {
    setResults(null);
    setParseError(null);
    if (!raw.trim()) {
      setRows([]);
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error: unknown) {
      setParseError(
        `Invalid JSON: ${error instanceof Error ? error.message : "parse error"}`,
      );
      setRows([]);
      return;
    }
    const items = Array.isArray(parsed) ? parsed : [parsed];
    if (items.length === 0) {
      setParseError("Empty array — nothing to import.");
      setRows([]);
      return;
    }
    setRows(items.map((it, i) => validateRow(it, i)));
  };

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      setRaw(text);
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Failed to read file",
        description: error instanceof Error ? error.message : "unknown",
      });
    }
  };

  const handleImport = async () => {
    const validRows = rows.filter((r) => r.ok && r.draft);
    if (validRows.length === 0) {
      toast({ variant: "destructive", title: "Nothing to import", description: "No valid rows." });
      return;
    }
    setImporting(true);
    const out: ImportResult[] = [];
    for (const row of validRows) {
      try {
        const payload = buildDraftPayload(row.draft!);
        const { data, error } = await supabase.rpc("save_admin_resource_draft", {
          payload,
        });
        if (error) throw error;
        const result =
          data && typeof data === "object" && !Array.isArray(data)
            ? (data as Record<string, unknown>)
            : {};
        if (result.ok !== true) throw new Error("Save failed");
        out.push({
          index: row.index,
          title: row.rawTitle,
          status: "ok",
          message: typeof result.slug === "string" ? result.slug : undefined,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown";
        logger.error("Draft save failed", { index: row.index, error: message });
        out.push({
          index: row.index,
          title: row.rawTitle,
          status: "error",
          message,
        });
      }
    }
    setImporting(false);
    setResults(out);
    const okCount = out.filter((r) => r.status === "ok").length;
    const failCount = out.length - okCount;
    toast({
      title: failCount ? "Imported with errors" : "Imported",
      description: `${okCount} saved as draft${failCount ? `, ${failCount} failed` : ""}.`,
      variant: failCount ? "destructive" : "default",
    });
  };

  return (
    <div className="space-y-6" dir={dir}>
      {/* Breadcrumb + explicit Back to Imports */}
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link
              to="/admin/content?tab=imports"
              data-json-back-to-imports
              aria-label="Back to Imports / العودة إلى الاستيراد"
              className="inline-flex min-h-[44px] min-w-[44px] items-center rounded-md px-2 py-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronLeft className="me-1 h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              Back to Imports / العودة إلى الاستيراد
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-foreground">
            V2 Resource JSON Importer
          </li>
        </ol>
      </nav>

      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <FileJson className="h-6 w-6 text-warm-gold" aria-hidden="true" />
            V2 Resource JSON Importer{isAr ? " / مستورد موارد V2 (JSON)" : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isAr
              ? "استيراد موارد V2 كمسودات في سير عمل النشر الموحّد. لا يتم النشر التلقائي، ولا تُحفظ الصفوف غير الصالحة."
              : "Import V2 resources as drafts into the unified publisher workflow. No auto-publish. Invalid rows are never persisted."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" className="min-h-[44px]">
            <Link to="/admin/content?tool=ai-studio">
              <Sparkles className="me-1.5 h-4 w-4" /> AI Studio
            </Link>
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Input */}
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-base">
              {isAr ? "المُدخل JSON" : "JSON input"}
            </CardTitle>
            <CardDescription>
              {isAr
                ? "الصق كائنًا واحدًا أو مصفوفة. الأنواع المدعومة: skill، automation، prompt، prompt_pack، image_style، bundle. الأسعار بالفلس الصحيح (KWD)."
                : "Paste a single object or an array. Supported types: skill, automation, prompt, prompt_pack, image_style, bundle. Prices in integer fils (KWD)."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="file"
                accept=".json,application/json"
                id="v2-json-upload"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px]"
                onClick={() => document.getElementById("v2-json-upload")?.click()}
              >
                <Upload className="me-1.5 h-4 w-4" /> {isAr ? "رفع ملف .json" : "Upload .json"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px]"
                onClick={() => setRaw(V2_SAMPLE_JSON)}
              >
                {isAr ? "تحميل عيّنة" : "Load sample"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="min-h-[44px]"
                onClick={() => { setRaw(""); setRows([]); setResults(null); setParseError(null); }}
                disabled={!raw && rows.length === 0}
              >
                {isAr ? "مسح" : "Clear"}
              </Button>
            </div>
            <Textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder='[{ "slug": "example-skill", "type": "skill", "title_en": "Example", ... }]'
              className="font-mono text-sm min-h-[360px]"
              spellCheck={false}
              aria-label="V2 resource JSON input"
              dir="ltr"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                onClick={handleValidate}
                className="min-h-[44px] bg-warm-gold hover:bg-warm-gold/90"
                disabled={!raw.trim()}
              >
                {isAr ? "تحقّق ومعاينة" : "Validate & preview"}
              </Button>
              <span className="text-xs text-muted-foreground">{raw.length} chars</span>
            </div>
            {parseError && (
              <div className="flex items-start gap-1 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4" />
                <span>{parseError}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-base">
              {isAr ? "المعاينة والاستيراد" : "Preview & import"}
            </CardTitle>
            <CardDescription>
              {isAr
                ? "يتم إنشاء مسودة واحدة لكل صف صالح عبر خدمة النشر المُخوَّلة. لا يتم النشر."
                : "One draft per valid row via the authorized publisher service. No publication."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <FileJson className="mb-3 h-10 w-10 opacity-40" aria-hidden="true" />
                <p className="text-sm">
                  {isAr ? "بانتظار مُدخل صالح…" : "Awaiting validated input…"}
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline">Total: {summary.total}</Badge>
                  <Badge variant="outline" className="text-emerald-700 border-emerald-500/40">
                    Valid: {summary.valid}
                  </Badge>
                  <Badge variant="outline" className="text-destructive border-destructive/40">
                    Invalid: {summary.invalid}
                  </Badge>
                  {summary.legacy > 0 && (
                    <Badge variant="outline">Legacy-mapped: {summary.legacy}</Badge>
                  )}
                </div>

                <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                  {rows.map((r) => (
                    <div
                      key={r.index}
                      className={`rounded-md border p-3 text-sm ${r.ok ? "bg-emerald-50/40 border-emerald-500/30" : "bg-destructive/5 border-destructive/40"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant="outline">#{r.index + 1}</Badge>
                          <span className="truncate font-medium">{r.rawTitle}</span>
                          {r.draft?.type && (
                            <Badge variant="secondary" className="text-[10px] uppercase">{r.draft.type}</Badge>
                          )}
                          {r.fromLegacy && <Badge variant="outline" className="text-[10px]">legacy → V2</Badge>}
                        </div>
                        {r.ok ? (
                          <Check className="h-4 w-4 text-emerald-600" aria-label="valid" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-destructive" aria-label="invalid" />
                        )}
                      </div>
                      {r.warnings.length > 0 && (
                        <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
                          {r.warnings.map((w, i) => <li key={i}>{w}</li>)}
                        </ul>
                      )}
                      {r.errors.length > 0 && (
                        <ul className="mt-1 list-disc pl-5 text-xs text-destructive">
                          {r.errors.map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                  <div className="text-xs text-muted-foreground">
                    {isAr
                      ? "سيتم إنشاء مسودة عبر save_admin_resource_draft لكل صف صالح."
                      : "One draft per valid row via save_admin_resource_draft."}
                  </div>
                  <Button
                    type="button"
                    onClick={handleImport}
                    disabled={importing || summary.valid === 0}
                    className="min-h-[44px] bg-warm-gold hover:bg-warm-gold/90"
                  >
                    {importing
                      ? (isAr ? "جارٍ الاستيراد…" : "Importing…")
                      : (isAr
                          ? `استيراد ${summary.valid} مسودة`
                          : `Import ${summary.valid} valid draft${summary.valid === 1 ? "" : "s"}`)}
                  </Button>
                </div>

                {results && (
                  <div className="space-y-1 border-t pt-3">
                    <div className="text-sm font-medium">
                      {isAr ? "نتائج الاستيراد" : "Import results"}
                    </div>
                    <ul className="space-y-1 text-xs">
                      {results.map((r) => (
                        <li
                          key={r.index}
                          className={r.status === "ok" ? "text-emerald-700" : "text-destructive"}
                        >
                          #{r.index + 1} · {r.title} — {r.status.toUpperCase()}
                          {r.message ? ` · ${r.message}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
