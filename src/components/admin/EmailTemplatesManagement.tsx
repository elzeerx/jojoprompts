import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Lock, Archive, RotateCcw } from "lucide-react";
import { EMAIL_RUNTIME_PATHS } from "@/lib/v2/admin/emailRuntimePaths";

/**
 * V2 Transactional Templates admin
 *
 * "Active system emails" is rendered from `emailRuntimePaths.ts`, which is
 * the single source of truth mapping each customer-facing email surface to
 * its ACTUAL runtime path in this repository. Any card status shown here is
 * whatever the registry currently declares — the UI never invents claims.
 *
 * Legacy `public.email_templates` rows are surfaced separately as archive-
 * only, with reversible Archive / Restore controls only (no hard delete,
 * no test-send).
 */

type EmailTemplateRow = {
  id: string;
  slug: string;
  name: string;
  type: string;
  subject: string;
  locale: string;
  is_active: boolean;
  updated_at: string;
};

// Re-export for backwards compatibility with existing importers/tests.
// New code should import `EMAIL_RUNTIME_PATHS` directly.
export const ACTIVE_SYSTEM_EMAILS = EMAIL_RUNTIME_PATHS;

export function EmailTemplatesManagement() {
  const { isAdmin, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<EmailTemplateRow[]>([]);
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("email_templates")
      .select("id, slug, name, type, subject, locale, is_active, updated_at")
      .order("is_active", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error) {
      toast({ variant: "destructive", title: "Load failed", description: error.message });
    } else {
      setItems((data as any) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.slug.toLowerCase().includes(q) ||
        i.name.toLowerCase().includes(q) ||
        i.type.toLowerCase().includes(q)
    );
  }, [items, query]);

  const setActive = async (row: EmailTemplateRow, next: boolean) => {
    if (!isAdmin) return;
    setPendingId(row.id);
    const { error } = await supabase
      .from("email_templates")
      .update({ is_active: next })
      .eq("id", row.id);

    if (error) {
      toast({ variant: "destructive", title: "Update failed", description: error.message });
    } else {
      // Preserve admin activity logging — Archive/Restore are reversible but
      // still auditable actions on a public schema table.
      try {
        await supabase.from("admin_audit_log").insert({
          admin_user_id: user?.id || "",
          action: next ? "email_template_restore" : "email_template_archive",
          target_resource: `email_templates:${row.slug}`,
          metadata: {
            template_id: row.id,
            slug: row.slug,
            previous_is_active: row.is_active,
            new_is_active: next,
            reason: "legacy_template_archive_ui",
            timestamp: new Date().toISOString(),
          },
        });
      } catch {
        // Audit log write is best-effort — do not block the UI update.
      }
      setItems((prev) =>
        prev.map((i) => (i.id === row.id ? { ...i, is_active: next } : i))
      );
      toast({ title: next ? "Restored" : "Archived" });
    }
    setPendingId(null);
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="section-title text-lg sm:text-xl">Transactional Templates</h1>
        <p className="text-muted-foreground text-xs sm:text-sm max-w-3xl">
          V2 delivers transactional email from application code and Supabase Auth. Each
          card below is generated from the source-of-truth registry
          (<code>emailRuntimePaths.ts</code>) so status can never drift from the actual
          runtime paths in this repository. Legacy <code>email_templates</code> rows are
          retained for history only — this screen only exposes reversible Archive /
          Restore controls in place of Test-send or Delete.
        </p>
      </header>

      {/* Section 1 — Active system emails (code-managed, read-only) */}
      <section aria-labelledby="active-system-emails-heading" className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <h2 id="active-system-emails-heading" className="text-base font-semibold text-dark-base">
            Active system emails
          </h2>
          <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
            <Lock className="h-3 w-3" aria-hidden /> Read-only · managed in code
          </span>
        </div>
        <div className="overflow-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-soft-bg/60">
              <tr>
                <th className="text-start p-3">Email</th>
                <th className="text-start p-3">Source</th>
                <th className="text-start p-3">Status</th>
                <th className="text-start p-3">Purpose</th>
              </tr>
            </thead>
            <tbody>
              {ACTIVE_SYSTEM_EMAILS.map((e) => (
                <tr key={e.key} className="border-t align-top">
                  <td className="p-3 font-medium text-dark-base">
                    <div>{e.name}</div>
                    <div dir="rtl" className="text-[11px] text-muted-foreground font-normal">
                      {e.nameAr}
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className="text-[10px]">
                      {e.source}
                    </Badge>
                  </td>
                  <td className="p-3">
                    {e.status === "active" ? (
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[10px]">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300">
                        Not configured
                      </Badge>
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    <div>{e.purpose}</div>
                    <div dir="rtl" className="text-[11px] mt-0.5">{e.purposeAr}</div>
                    {e.status === "not_configured" && e.notConfiguredReason && (
                      <div className="mt-1 text-[11px] text-amber-700">
                        {e.notConfiguredReason}
                      </div>
                    )}
                    {e.runtimePaths.length > 0 && (
                      <ul className="mt-1 text-[11px] text-muted-foreground/80 list-disc ps-4">
                        {e.runtimePaths.map((p) => (
                          <li key={p}><code>{p}</code></li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 2 — Legacy template archive (DB rows, reversible actions only) */}
      <section aria-labelledby="legacy-template-archive-heading" className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 id="legacy-template-archive-heading" className="text-base font-semibold text-dark-base">
              Legacy template archive
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Reversible Archive / Restore only. No hard delete, no test-send.
            </p>
          </div>
          <Input
            placeholder="Search by slug, name, type"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full sm:w-64"
          />
        </div>

        <div className="overflow-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-soft-bg/60">
              <tr>
                <th className="text-left p-3">Slug</th>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Locale</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    <Loader2 className="h-4 w-4 mr-2 inline animate-spin" /> Loading legacy templates…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    No legacy templates match.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="p-3 font-mono text-xs sm:text-sm">{t.slug}</td>
                    <td className="p-3">{t.name}</td>
                    <td className="p-3">{t.type}</td>
                    <td className="p-3">{t.locale}</td>
                    <td className="p-3">
                      <Badge
                        variant={t.is_active ? "secondary" : "outline"}
                        className="text-[10px]"
                      >
                        {t.is_active ? "Active (legacy)" : "Archived"}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      {t.is_active ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pendingId === t.id}
                          onClick={() => setActive(t, false)}
                        >
                          {pendingId === t.id ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Archive className="h-4 w-4 mr-1" />
                          )}
                          Archive
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={pendingId === t.id}
                          onClick={() => setActive(t, true)}
                        >
                          {pendingId === t.id ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <RotateCcw className="h-4 w-4 mr-1" />
                          )}
                          Restore
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default EmailTemplatesManagement;
