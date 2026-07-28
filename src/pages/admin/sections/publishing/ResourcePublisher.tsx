import { cloneElement, isValidElement, useEffect, useId, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Loader2, Save, Send, ClipboardCheck, ExternalLink, AlertTriangle, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { PackageUploader } from "./PackageUploader";

type ResourceType =
  | "skill" | "automation" | "prompt" | "prompt_pack" | "image_style" | "bundle";
// Per-resource lifetime is intentionally excluded.
// V2 has exactly one global 30.000 KWD lifetime pass; resources use free / individual, bundles use bundle.
type ProductType = "free" | "individual" | "bundle";
type PermissionKind = "capability" | "dependency" | "service" | "secret";

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const draftSchema = z.object({
  slug: z.string().min(3).max(80).regex(SLUG_RE, "kebab-case only"),
  type: z.enum(["skill","automation","prompt","prompt_pack","image_style","bundle"]),
  title_en: z.string().min(2).max(140),
  title_ar: z.string().max(140).optional().or(z.literal("")),
  summary_en: z.string().max(280).optional().or(z.literal("")),
  summary_ar: z.string().max(280).optional().or(z.literal("")),
  description_en: z.string().max(20000).optional().or(z.literal("")),
  description_ar: z.string().max(20000).optional().or(z.literal("")),
  category: z.string().max(80).optional().or(z.literal("")),
  tags: z.string().max(400).optional().or(z.literal("")),
  hero_image_path: z.string().max(400).optional().or(z.literal("")),
  effort_minutes: z.string().optional(),
});

interface PlatformRow {
  platform_slug: string; min_version: string; notes_en: string; notes_ar: string; is_verified: boolean;
}
interface GuideStep { title: string; body: string }
interface GuideRow {
  platform_slug: string; steps: GuideStep[]; estimated_minutes: string;
}
interface PermRow { kind: PermissionKind; key: string; label_en: string; is_required: boolean; is_public: boolean }
interface ProductRow { sku: string; product_type: ProductType; title_en: string; price_fils: string }
interface LicenseRow { license_key: string; terms_en: string; allows_commercial: boolean; allows_redistribution: boolean }

interface FormState {
  slug: string; type: ResourceType;
  title_en: string; title_ar: string;
  summary_en: string; summary_ar: string;
  description_en: string; description_ar: string;
  examples_en: string; examples_ar: string;
  limitations_en: string; limitations_ar: string;
  uninstall_en: string; uninstall_ar: string;
  support_en: string; support_ar: string;
  update_info_en: string; update_info_ar: string;
  category: string; tags: string; hero_image_path: string; effort_minutes: string;
  version: string; changelog_en: string; is_new_version: boolean;
  platform_compatibility: PlatformRow[];
  installation_guides: GuideRow[];
  permissions: PermRow[];
  license: LicenseRow;
  products: ProductRow[];
  bundle_items: string[];
}

const emptyForm = (type: ResourceType = "skill"): FormState => ({
  slug: "", type,
  title_en: "", title_ar: "",
  summary_en: "", summary_ar: "",
  description_en: "", description_ar: "",
  examples_en: "", examples_ar: "",
  limitations_en: "", limitations_ar: "",
  uninstall_en: "", uninstall_ar: "",
  support_en: "", support_ar: "",
  update_info_en: "", update_info_ar: "",
  category: "", tags: "", hero_image_path: "", effort_minutes: "",
  version: "1.0.0", changelog_en: "", is_new_version: false,
  platform_compatibility: [],
  installation_guides: [],
  permissions: [],
  license: { license_key: "", terms_en: "", allows_commercial: false, allows_redistribution: false },
  products: [{ sku: "", product_type: "free", title_en: "", price_fils: "0" }],
  bundle_items: [],
});


// Approved V2 pricing hints (KWD). Admin remains free to override.
const TYPE_PRICE_HINT: Record<ResourceType, string> = {
  skill: "Approved range 1.500–3.000 KWD.",
  automation: "Approved range 2.500–5.000 KWD.",
  prompt: "Approved default 0.900 KWD.",
  prompt_pack: "Approved default 1.500 KWD.",
  image_style: "Approved default 0.900 KWD.",
  bundle: "Approved range 4.500–12.000 KWD (bundle offer is a single positive price).",
};

const APPROVED_DEFAULT_PRICE_FILS: Record<ResourceType, number> = {
  skill: 1500,
  automation: 2500,
  prompt: 900,
  prompt_pack: 1500,
  image_style: 900,
  bundle: 4500,
};

// Direct FK from resources to its own rows/embeds only. The bundle-membership
// relation (product_bundle_items.bundle_product_id → products.id) is NOT a
// direct FK from resources, so it must be loaded in a second query keyed on
// the resource's own products.
export const RESOURCE_EDITOR_SELECT =
  "id, slug, type, title_en, title_ar, summary_en, summary_ar, description_en, description_ar, examples_en, examples_ar, limitations_en, limitations_ar, uninstall_en, uninstall_ar, support_en, support_ar, update_info_en, update_info_ar, category, tags, hero_image_path, effort_minutes, current_version_id, platform_compatibility(*), installation_guides(*), resource_permissions(*), licenses(*), current_version:current_version_id(id,version,changelog_en,changelog_ar), products(id,sku,product_type,title_en,price_fils,is_active)";

export function buildResourceEditUrl(resourceId: string): string {
  return `/admin/publishing/resources/${resourceId}/edit`;
}

async function fetchResource(id: string) {
  const { data, error } = await (supabase as any)
    .from("resources")
    .select(RESOURCE_EDITOR_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  // Load bundle items via the resource's own bundle-typed products.
  const productIds: string[] = (data.products ?? [])
    .filter((p: any) => p?.product_type === "bundle")
    .map((p: any) => p.id);
  let bundleItems: { resource_id: string }[] = [];
  if (productIds.length > 0) {
    const { data: items, error: bErr } = await (supabase as any)
      .from("product_bundle_items")
      .select("resource_id")
      .in("bundle_product_id", productIds);
    if (bErr) throw bErr;
    bundleItems = items ?? [];
  }
  return { ...data, product_bundle_items: bundleItems };
}

async function fetchPlatforms(): Promise<{ slug: string; name: string }[]> {
  const { data } = await (supabase as any).from("platforms").select("slug,name,display_order").eq("is_active", true).order("display_order");
  return (data ?? []).map((p: any) => ({ slug: p.slug, name: p.name }));
}

interface PublisherProps { mode: "new" | "edit" | "new-version" }

export default function ResourcePublisher({ mode }: PublisherProps) {
  const params = useParams<{ resourceId?: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const resourceId = params.resourceId;
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [publishErrors, setPublishErrors] = useState<string[] | null>(null);

  const { data: platforms = [] } = useQuery({
    queryKey: ["admin","v2","platforms"], queryFn: fetchPlatforms, staleTime: 60_000,
  });

  const {
    data: existing,
    isLoading: loadingResource,
    isError: resourceLoadError,
    error: resourceError,
  } = useQuery({
    queryKey: ["admin","v2","publisher","resource", resourceId],
    queryFn: () => fetchResource(resourceId!),
    enabled: !!resourceId,
    retry: false,
  });

  useEffect(() => {
    if (!existing) return;
    setForm({
      slug: existing.slug ?? "",
      type: (existing.type ?? "skill") as ResourceType,
      title_en: existing.title_en ?? "", title_ar: existing.title_ar ?? "",
      summary_en: existing.summary_en ?? "", summary_ar: existing.summary_ar ?? "",
      description_en: existing.description_en ?? "", description_ar: existing.description_ar ?? "",
      examples_en: existing.examples_en ?? "", examples_ar: existing.examples_ar ?? "",
      limitations_en: existing.limitations_en ?? "", limitations_ar: existing.limitations_ar ?? "",
      uninstall_en: existing.uninstall_en ?? "", uninstall_ar: existing.uninstall_ar ?? "",
      support_en: existing.support_en ?? "", support_ar: existing.support_ar ?? "",
      update_info_en: existing.update_info_en ?? "", update_info_ar: existing.update_info_ar ?? "",
      category: existing.category ?? "", tags: (existing.tags ?? []).join(", "),
      hero_image_path: existing.hero_image_path ?? "",
      effort_minutes: existing.effort_minutes == null ? "" : String(existing.effort_minutes),
      version: mode === "new-version" ? "" : (existing.current_version?.version ?? "1.0.0"),
      changelog_en: mode === "new-version" ? "" : (existing.current_version?.changelog_en ?? ""),
      is_new_version: mode === "new-version",
      platform_compatibility: (existing.platform_compatibility ?? []).map((p: any) => ({
        platform_slug: p.platform_slug, min_version: p.min_version ?? "",
        notes_en: p.notes_en ?? "", notes_ar: p.notes_ar ?? "",
        is_verified: !!p.is_verified,
      })),
      installation_guides: (existing.installation_guides ?? []).map((g: any) => ({
        platform_slug: g.platform_slug,
        steps: Array.isArray(g.steps_en)
          ? g.steps_en.map((s: any) => typeof s === "string" ? { title: s, body: "" } : { title: s?.title ?? "", body: s?.body ?? "" })
          : [],
        estimated_minutes: g.estimated_minutes == null ? "" : String(g.estimated_minutes),
      })),
      permissions: (existing.resource_permissions ?? []).map((p: any) => ({
        kind: p.kind, key: p.key, label_en: p.label_en ?? "",
        is_required: !!p.is_required, is_public: p.is_public !== false,
      })),
      license: existing.licenses?.[0]
        ? {
            license_key: existing.licenses[0].license_key,
            terms_en: existing.licenses[0].terms_en ?? "",
            allows_commercial: !!existing.licenses[0].allows_commercial,
            allows_redistribution: !!existing.licenses[0].allows_redistribution,
          }
        : { license_key: "", terms_en: "", allows_commercial: false, allows_redistribution: false },
      products: (existing.products ?? []).filter((p: any) => p.is_active).map((p: any) => ({
        sku: p.sku, product_type: p.product_type, title_en: p.title_en, price_fils: String(p.price_fils ?? 0),
      })),
      bundle_items: (existing.product_bundle_items ?? []).map((b: any) => b.resource_id),
    });
    setDirty(false);
  }, [existing, mode]);

  const patch = (p: Partial<FormState>) => { setForm((f) => ({ ...f, ...p })); setDirty(true); };

  // Validate before submit
  const validate = (): boolean => {
    const parsed = draftSchema.safeParse({
      slug: form.slug, type: form.type,
      title_en: form.title_en, title_ar: form.title_ar,
      summary_en: form.summary_en, summary_ar: form.summary_ar,
      description_en: form.description_en, description_ar: form.description_ar,
      category: form.category, tags: form.tags,
      hero_image_path: form.hero_image_path, effort_minutes: form.effort_minutes,
    });
    if (!parsed.success) {
      const map: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { map[i.path.join(".")] = i.message; });
      setErrors(map);
      toast({ variant: "destructive", title: "Fix validation errors", description: Object.values(map)[0] });
      return false;
    }
    setErrors({});
    return true;
  };

  const buildPayload = () => ({
    resource_id: resourceId ?? null,
    resource: {
      slug: form.slug.trim(),
      type: form.type,
      title_en: form.title_en.trim(),
      title_ar: form.title_ar.trim() || null,
      summary_en: form.summary_en.trim() || null,
      summary_ar: form.summary_ar.trim() || null,
      description_en: form.description_en.trim() || null,
      description_ar: form.description_ar.trim() || null,
      examples_en: form.examples_en.trim() || null,
      examples_ar: form.examples_ar.trim() || null,
      limitations_en: form.limitations_en.trim() || null,
      limitations_ar: form.limitations_ar.trim() || null,
      uninstall_en: form.uninstall_en.trim() || null,
      uninstall_ar: form.uninstall_ar.trim() || null,
      support_en: form.support_en.trim() || null,
      support_ar: form.support_ar.trim() || null,
      update_info_en: form.update_info_en.trim() || null,
      update_info_ar: form.update_info_ar.trim() || null,
      category: form.category.trim() || null,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      hero_image_path: form.hero_image_path.trim() || null,
      effort_minutes: form.effort_minutes.trim() || null,
    },
    version: (form.version || form.changelog_en || form.is_new_version) ? {
      version: form.version.trim() || "1.0.0",
      changelog_en: form.changelog_en || null,
      is_new_version: form.is_new_version,
    } : null,
    platform_compatibility: form.platform_compatibility,
    installation_guides: form.installation_guides.map((g) => ({
      platform_slug: g.platform_slug,
      steps_en: g.steps.filter((s) => s.title || s.body),
      steps_ar: [],
      estimated_minutes: g.estimated_minutes || null,
    })),
    permissions: form.permissions,
    license: form.license.license_key ? form.license : null,
    products: form.products.filter((p) => p.sku.trim() && p.title_en.trim()).map((p) => ({
      ...p, price_fils: parseInt(p.price_fils || "0", 10) || 0, currency: "KWD",
    })),
    bundle_items: form.type === "bundle" ? form.bundle_items : [],
  });

  const saveDraft = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc("save_admin_resource_draft", { payload: buildPayload() });
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error("Save failed");
      return data as { ok: true; resource_id: string; slug: string };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["admin","v2","catalog"] });
      qc.invalidateQueries({ queryKey: ["admin","v2","publisher","resource", res.resource_id] });
      toast({ title: "Draft saved", description: `/${res.slug}` });
      setDirty(false);
      if (!resourceId) navigate(`/admin/publishing/resources/${res.resource_id}/edit`, { replace: true });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Save failed", description: err?.message ?? "unknown" }),
  });

  const submitReview = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase as any).rpc("admin_transition_resource_lifecycle", { p_resource_id: id, p_action: "review" });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin","v2","catalog"] });
      toast({ title: "Submitted for review" });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Failed", description: err?.message ?? "unknown" }),
  });

  const publish = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase as any).rpc("admin_publish_resource", { p_resource_id: id });
      if (error) throw error;
      return data as { ok: boolean; errors?: string[] };
    },
    onSuccess: (res) => {
      if (!res.ok) { setPublishErrors(res.errors ?? ["unknown"]); return; }
      qc.invalidateQueries({ queryKey: ["admin","v2","catalog"] });
      qc.invalidateQueries({ queryKey: ["admin","v2","overview"] });
      toast({ title: "Published" });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Publish failed", description: err?.message ?? "unknown" }),
  });

  // Client-side publish gates. Server remains authoritative.
  const clientPublishGates = (): string[] => {
    const gates: string[] = [];
    if (!form.title_en.trim()) gates.push("Title (EN) is required to publish.");
    if (!form.summary_en.trim()) gates.push("Summary (EN) is required to publish.");
    if (!form.description_en.trim()) gates.push("Description (EN) is required to publish.");
    if (form.type === "skill" || form.type === "automation") {
      if (form.platform_compatibility.length === 0) gates.push("At least one platform compatibility entry is required.");
      if (form.installation_guides.length === 0) gates.push("At least one installation guide is required.");
    }
    if (!form.version.trim()) gates.push("Version is required.");
    if (!/^[0-9]+\.[0-9]+\.[0-9]+([.\-+][A-Za-z0-9._-]+)?$/.test(form.version.trim())) {
      gates.push("Version must look like 1.0.0.");
    }
    const products = form.products.filter((p) => p.sku.trim());
    if (products.length === 0) gates.push("Add at least one product (free or paid).");
    for (const p of products) {
      const price = parseInt(p.price_fils || "0", 10);
      if (p.product_type === "free" && price !== 0) gates.push(`Free product ${p.sku} must have price 0.`);
      if (p.product_type !== "free" && price <= 0) gates.push(`Paid product ${p.sku} must have a positive price.`);
      if (form.type === "bundle" && p.product_type === "individual") gates.push(`Bundle resources cannot have individual products.`);
      if (form.type !== "bundle" && p.product_type === "bundle") gates.push(`Only bundle resources can have bundle products.`);
    }
    if (form.type === "bundle") {
      const hasPositiveBundle = products.some((p) => p.product_type === "bundle" && parseInt(p.price_fils || "0", 10) > 0);
      if (!hasPositiveBundle) gates.push("A bundle resource needs at least one positive-priced bundle product.");
      const seen = new Set<string>();
      for (const id of form.bundle_items) {
        if (id === resourceId) { gates.push("A bundle cannot include itself."); break; }
        if (seen.has(id)) { gates.push("Bundle items must be unique."); break; }
        seen.add(id);
      }
    }
    return gates;
  };

  // Persist first, always, when the form is dirty or when this is a new/new-version flow.
  const ensureSaved = async (): Promise<string> => {
    const needsSave = dirty || !resourceId || form.is_new_version || mode === "new-version";
    if (!needsSave && resourceId) return resourceId;
    const res = await saveDraft.mutateAsync();
    return res.resource_id;
  };

  const onSave = async () => { if (!validate()) return; await saveDraft.mutateAsync(); };

  const onSubmit = async () => {
    if (!validate()) return;
    let id: string;
    try { id = await ensureSaved(); }
    catch { return; } // Save error already toasted; do not transition.
    await submitReview.mutateAsync(id);
  };

  const onPublish = async () => {
    if (!validate()) return;
    const gates = clientPublishGates();
    if (gates.length > 0) { setPublishErrors(gates); return; }
    let id: string;
    try { id = await ensureSaved(); }
    catch { return; }
    await publish.mutateAsync(id);
  };

  const title = useMemo(() => {
    if (mode === "new") return "New Resource";
    if (mode === "new-version") return `New version · ${form.title_en || form.slug || "resource"}`;
    return `Edit · ${form.title_en || form.slug || "resource"}`;
  }, [mode, form.title_en, form.slug]);

  const busy = saveDraft.isPending || submitReview.isPending || publish.isPending;
  const disabledSave = busy || (!dirty && !!resourceId && mode !== "new-version");

  const needsPackage = form.type === "skill" || form.type === "automation";

  if (loadingResource) return <div className="p-6 text-sm text-muted-foreground">Loading resource…</div>;

  // Distinguish load failure (PostgREST/query error, forbidden) from a true zero-row not-found.
  if ((mode === "edit" || mode === "new-version") && resourceId && resourceLoadError) {
    const msg = (resourceError as { message?: string } | null)?.message ?? "";
    const isForbidden = /permission|forbidden|denied|rls/i.test(msg);
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-xl font-semibold text-dark-base">
          {isForbidden ? "Access denied" : "Failed to load resource"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isForbidden
            ? "You do not have permission to open this resource."
            : "The editor query failed. This is not a missing-resource error — please retry or check the network log."}
          {" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">{resourceId}</code>
        </p>
        {msg && (
          <pre className="max-w-full overflow-x-auto rounded bg-muted p-2 text-xs">{msg}</pre>
        )}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/admin/catalog")}>Back to Catalog</Button>
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["admin","v2","publisher","resource", resourceId] })}>Retry</Button>
        </div>
      </div>
    );
  }

  // Not-found guard: an edit/new-version route with a resourceId that returned no row
  // must never render a blank editable form (which would silently create a new resource on save).
  if ((mode === "edit" || mode === "new-version") && resourceId && !existing) {
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-xl font-semibold text-dark-base">Resource not found</h1>
        <p className="text-sm text-muted-foreground">
          The resource <code className="rounded bg-muted px-1 py-0.5 text-xs">{resourceId}</code> does not exist
          or you do not have access to it. It may have been archived or the link may be wrong.
        </p>
        <Button variant="outline" size="sm" onClick={() => navigate("/admin/catalog")}>
          Back to Catalog
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-dark-base sm:text-2xl">{title}</h1>
          <p className="text-sm text-muted-foreground">
            All money stored as integer fils. Every eligible Jojo resource is included with the 30.000 KWD Lifetime pass.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {resourceId ? (
            <Button asChild variant="outline" size="sm" className="min-h-[44px]">
              <Link to={`/resources/${form.slug || ""}`} target="_blank" rel="noreferrer">
                <ExternalLink className="me-1.5 h-3.5 w-3.5" /> Preview public
              </Link>
            </Button>
          ) : null}
          <Button variant="outline" size="sm" className="min-h-[44px]" onClick={onSubmit} disabled={busy}>
            <ClipboardCheck className="me-1.5 h-3.5 w-3.5" /> Submit for review
          </Button>
          <Button size="sm" className="min-h-[44px] bg-warm-gold text-dark-base hover:bg-warm-gold/90" onClick={onPublish} disabled={busy}>
            <Send className="me-1.5 h-3.5 w-3.5" /> Publish
          </Button>
          <Button size="sm" className="min-h-[44px]" onClick={onSave} disabled={disabledSave}>
            {saveDraft.isPending ? <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="me-1.5 h-3.5 w-3.5" />}
            Save draft
          </Button>
        </div>
      </header>

      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            Drafts are only created after you click <strong>Save draft</strong>. AI Studio and JSON Importer can be launched
            from Publishing → Imports and must return values here — an untouched AI Studio session will never create a resource.
            Publish runs full server-side validation.
          </div>
        </div>
      </div>

      <Accordion type="multiple" defaultValue={["type","meta","platforms","commerce"]} className="space-y-2">
        {/* Type & source */}
        <AccordionItem value="type">
          <AccordionTrigger className="text-sm font-semibold">1 · Type & source</AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="type">Type</Label>
                <Select value={form.type} onValueChange={(v) => patch({ type: v as ResourceType })}>
                  <SelectTrigger id="type" className="min-h-[44px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["skill","automation","prompt","prompt_pack","image_style","bundle"] as ResourceType[]).map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Source</Label>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm" className="min-h-[44px]">
                    <Link to="/admin/publishing/imports/json"><ExternalLink className="me-1.5 h-3.5 w-3.5" /> JSON Importer</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="min-h-[44px]">
                    <Link to="/admin/publishing/imports/ai-studio"><ExternalLink className="me-1.5 h-3.5 w-3.5" /> AI Studio</Link>
                  </Button>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Metadata */}
        <AccordionItem value="meta">
          <AccordionTrigger className="text-sm font-semibold">2 · Bilingual metadata</AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Slug (kebab-case)" required error={errors.slug}>
                <Input value={form.slug} onChange={(e) => patch({ slug: e.target.value })} className="min-h-[44px]" placeholder="my-resource" />
              </Field>
              <Field label="Category">
                <Input value={form.category} onChange={(e) => patch({ category: e.target.value })} className="min-h-[44px]" />
              </Field>
              <Field label="Title (EN)" required error={errors.title_en}>
                <Input value={form.title_en} onChange={(e) => patch({ title_en: e.target.value })} className="min-h-[44px]" />
              </Field>
              <Field label="Title (AR)" dir="rtl">
                <Input value={form.title_ar} onChange={(e) => patch({ title_ar: e.target.value })} className="min-h-[44px] text-right" dir="rtl" />
              </Field>
              <Field label="Summary (EN)">
                <Textarea value={form.summary_en} onChange={(e) => patch({ summary_en: e.target.value })} rows={2} maxLength={280} />
              </Field>
              <Field label="Summary (AR)" dir="rtl">
                <Textarea value={form.summary_ar} onChange={(e) => patch({ summary_ar: e.target.value })} rows={2} maxLength={280} className="text-right" dir="rtl" />
              </Field>
              <Field label="Description (EN)">
                <Textarea value={form.description_en} onChange={(e) => patch({ description_en: e.target.value })} rows={6} />
              </Field>
              <Field label="Description (AR)" dir="rtl">
                <Textarea value={form.description_ar} onChange={(e) => patch({ description_ar: e.target.value })} rows={6} className="text-right" dir="rtl" />
              </Field>
              <Field label="Tags (comma-separated)">
                <Input value={form.tags} onChange={(e) => patch({ tags: e.target.value })} className="min-h-[44px]" placeholder="research, review, extraction" />
              </Field>
              <Field label="Hero image storage path">
                <Input value={form.hero_image_path} onChange={(e) => patch({ hero_image_path: e.target.value })} className="min-h-[44px]" />
              </Field>
              <Field label="Effort (minutes)">
                <Input inputMode="numeric" value={form.effort_minutes} onChange={(e) => patch({ effort_minutes: e.target.value.replace(/\D/g, "") })} className="min-h-[44px]" />
              </Field>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Platforms */}
        <AccordionItem value="platforms">
          <AccordionTrigger className="text-sm font-semibold">
            3 · Platform compatibility {needsPackage ? <Badge className="ms-2" variant="secondary">required for publish</Badge> : null}
          </AccordionTrigger>
          <AccordionContent>
            <PlatformEditor
              platforms={platforms}
              value={form.platform_compatibility}
              onChange={(v) => patch({ platform_compatibility: v })}
            />
            <div className="mt-3">
              <Label>Version</Label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Input value={form.version} onChange={(e) => patch({ version: e.target.value })} className="min-h-[44px]" placeholder="1.0.0" />
                <Textarea value={form.changelog_en} onChange={(e) => patch({ changelog_en: e.target.value })} rows={2} className="sm:col-span-2" placeholder="Changelog (EN)" />
              </div>
              {mode === "new-version" ? (
                <p className="mt-2 text-xs text-warm-gold">A new resource_versions row will be created and marked current; prior versions and files are preserved.</p>
              ) : (
                <label className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox checked={form.is_new_version} onCheckedChange={(v) => patch({ is_new_version: v === true })} />
                  Create as new version (preserve prior)
                </label>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Permissions */}
        <AccordionItem value="perms">
          <AccordionTrigger className="text-sm font-semibold">4 · Permissions / dependencies</AccordionTrigger>
          <AccordionContent>
            <PermissionEditor value={form.permissions} onChange={(v) => patch({ permissions: v })} />
          </AccordionContent>
        </AccordionItem>

        {/* Guides & license */}
        <AccordionItem value="guides">
          <AccordionTrigger className="text-sm font-semibold">
            5 · Installation guides {needsPackage ? <Badge className="ms-2" variant="secondary">required for publish</Badge> : null}
          </AccordionTrigger>
          <AccordionContent>
            <GuideEditor platforms={platforms} value={form.installation_guides} onChange={(v) => patch({ installation_guides: v })} />
            <div className="mt-4 border-t pt-4">
              <h3 className="mb-2 text-sm font-semibold">License</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input placeholder="License key (e.g. MIT, CC-BY-4.0)" className="min-h-[44px]"
                  value={form.license.license_key}
                  onChange={(e) => patch({ license: { ...form.license, license_key: e.target.value } })} />
                <Textarea placeholder="Terms (EN)" rows={2}
                  value={form.license.terms_en}
                  onChange={(e) => patch({ license: { ...form.license, terms_en: e.target.value } })} />
                <label className="inline-flex items-center gap-2 text-sm">
                  <Checkbox checked={form.license.allows_commercial}
                    onCheckedChange={(v) => patch({ license: { ...form.license, allows_commercial: v === true } })} />
                  Allows commercial use
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <Checkbox checked={form.license.allows_redistribution}
                    onCheckedChange={(v) => patch({ license: { ...form.license, allows_redistribution: v === true } })} />
                  Allows redistribution
                </label>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Commerce */}
        <AccordionItem value="commerce">
          <AccordionTrigger className="text-sm font-semibold">6 · Commerce</AccordionTrigger>
          <AccordionContent>
            <p className="mb-2 text-xs text-muted-foreground">{TYPE_PRICE_HINT[form.type]}</p>
            <p className="mb-3 text-xs text-warm-gold">Every eligible resource is included with the 30.000 KWD Lifetime pass.</p>
            <ProductEditor value={form.products} onChange={(v) => patch({ products: v })} defaultSku={form.slug} />
            {form.type === "bundle" ? (
              <div className="mt-3 border-t pt-3">
                <Label>Bundle items (resource IDs)</Label>
                <Textarea rows={3} placeholder="One UUID per line" value={form.bundle_items.join("\n")}
                  onChange={(e) => patch({ bundle_items: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} />
              </div>
            ) : null}
          </AccordionContent>
        </AccordionItem>

        {/* Package upload — skill/automation only, after first save creates a version */}
        {needsPackage ? (
          <AccordionItem value="package">
            <AccordionTrigger>Package files & scan</AccordionTrigger>
            <AccordionContent>
              {!resourceId || !existing?.current_version_id ? (
                <p className="text-sm text-muted-foreground">
                  Save the draft first — an initial version is created on save, and uploads attach to that version.
                </p>
              ) : (
                <PackageUploader
                  resourceId={resourceId}
                  resourceVersionId={existing.current_version_id}
                  resourceType={form.type as "skill" | "automation"}
                />
              )}
            </AccordionContent>
          </AccordionItem>
        ) : null}
      </Accordion>

      <Dialog open={!!publishErrors} onOpenChange={(v) => (v ? null : setPublishErrors(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-4 w-4" aria-hidden /> Publish blocked
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Server-side validation returned:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-sm font-mono">
            {(publishErrors ?? []).map((e, i) => <li key={i}>{e}</li>)}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishErrors(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, required, error, dir, children }: { label: string; required?: boolean; error?: string; dir?: "ltr" | "rtl" | "auto"; children: React.ReactNode }) {
  const controlId = useId();
  const errorId = `${controlId}-error`;
  const effectiveControlId = isValidElement<{ id?: string }>(children)
    ? children.props.id ?? controlId
    : controlId;
  const control = isValidElement<{
    id?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }>(children)
    ? cloneElement(children, {
        id: effectiveControlId,
        "aria-describedby": error
          ? [children.props["aria-describedby"], errorId].filter(Boolean).join(" ")
          : children.props["aria-describedby"],
        "aria-invalid": error ? true : children.props["aria-invalid"],
      })
    : children;

  return (
    <div>
      <Label className="text-xs" dir={dir} htmlFor={effectiveControlId}>
        {label}{required ? <span className="text-red-600"> *</span> : null}
      </Label>
      {control}
      {error ? <p id={errorId} className="mt-1 text-[11px] text-red-600">{error}</p> : null}
    </div>
  );
}

function PlatformEditor({ platforms, value, onChange }: {
  platforms: { slug: string; name: string }[];
  value: PlatformRow[];
  onChange: (v: PlatformRow[]) => void;
}) {
  return (
    <div className="space-y-2">
      {value.map((row, idx) => (
        <div key={idx} className="grid grid-cols-1 items-center gap-2 rounded border border-gray-200 p-2 sm:grid-cols-6">
          <Select value={row.platform_slug} onValueChange={(v) => {
            const next = [...value]; next[idx] = { ...row, platform_slug: v }; onChange(next);
          }}>
            <SelectTrigger className="min-h-[44px] sm:col-span-2" aria-label="Platform"><SelectValue placeholder="Platform" /></SelectTrigger>
            <SelectContent>
              {platforms.map((p) => <SelectItem key={p.slug} value={p.slug}>{p.name}</SelectItem>)}
              <SelectItem value="generic">Generic / manual</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Min version" className="min-h-[44px]"
            value={row.min_version}
            onChange={(e) => { const next = [...value]; next[idx] = { ...row, min_version: e.target.value }; onChange(next); }} />
          <Input placeholder="Notes (EN)" className="min-h-[44px] sm:col-span-2"
            value={row.notes_en}
            onChange={(e) => { const next = [...value]; next[idx] = { ...row, notes_en: e.target.value }; onChange(next); }} />
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1 text-xs">
              <Checkbox checked={row.is_verified}
                onCheckedChange={(v) => { const next = [...value]; next[idx] = { ...row, is_verified: v === true }; onChange(next); }} />
              Verified
            </label>
            <Button size="sm" variant="ghost" className="min-h-[40px] text-red-700"
              onClick={() => onChange(value.filter((_, i) => i !== idx))}>Remove</Button>
          </div>
        </div>
      ))}
      <Button size="sm" variant="outline" className="min-h-[44px]"
        onClick={() => onChange([...value, { platform_slug: "", min_version: "", notes_en: "", notes_ar: "", is_verified: false }])}>
        + Add platform
      </Button>
    </div>
  );
}

function GuideEditor({ platforms, value, onChange }: {
  platforms: { slug: string; name: string }[];
  value: GuideRow[];
  onChange: (v: GuideRow[]) => void;
}) {
  return (
    <div className="space-y-3">
      {value.map((row, idx) => (
        <div key={idx} className="rounded border border-gray-200 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Select value={row.platform_slug} onValueChange={(v) => {
              const next = [...value]; next[idx] = { ...row, platform_slug: v }; onChange(next);
            }}>
              <SelectTrigger className="min-h-[44px]" aria-label="Guide platform"><SelectValue placeholder="Platform" /></SelectTrigger>
              <SelectContent>
                {platforms.map((p) => <SelectItem key={p.slug} value={p.slug}>{p.name}</SelectItem>)}
                <SelectItem value="generic">Generic</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Estimated minutes" className="min-h-[44px]"
              value={row.estimated_minutes}
              onChange={(e) => { const next = [...value]; next[idx] = { ...row, estimated_minutes: e.target.value.replace(/\D/g, "") }; onChange(next); }} />
            <Button size="sm" variant="ghost" className="min-h-[44px] text-red-700"
              onClick={() => onChange(value.filter((_, i) => i !== idx))}>Remove guide</Button>
          </div>
          <div className="mt-2 space-y-2">
            {row.steps.map((s, si) => (
              <div key={si} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Input placeholder={`Step ${si + 1} title`} className="min-h-[44px]"
                  value={s.title}
                  onChange={(e) => {
                    const next = [...value];
                    const steps = [...row.steps]; steps[si] = { ...s, title: e.target.value };
                    next[idx] = { ...row, steps }; onChange(next);
                  }} />
                <Textarea placeholder="Body" className="sm:col-span-2" rows={2}
                  value={s.body}
                  onChange={(e) => {
                    const next = [...value];
                    const steps = [...row.steps]; steps[si] = { ...s, body: e.target.value };
                    next[idx] = { ...row, steps }; onChange(next);
                  }} />
              </div>
            ))}
            <Button size="sm" variant="outline" className="min-h-[40px]"
              onClick={() => {
                const next = [...value]; next[idx] = { ...row, steps: [...row.steps, { title: "", body: "" }] }; onChange(next);
              }}>+ Add step</Button>
          </div>
        </div>
      ))}
      <Button size="sm" variant="outline" className="min-h-[44px]"
        onClick={() => onChange([...value, { platform_slug: "", steps: [], estimated_minutes: "" }])}>+ Add guide</Button>
    </div>
  );
}

function PermissionEditor({ value, onChange }: { value: PermRow[]; onChange: (v: PermRow[]) => void }) {
  const kinds: PermissionKind[] = ["capability","dependency","service","secret"];
  return (
    <div className="space-y-2">
      {value.map((row, idx) => (
        <div key={idx} className="grid grid-cols-1 gap-2 rounded border border-gray-200 p-2 sm:grid-cols-6">
          <Select value={row.kind} onValueChange={(v) => { const next = [...value]; next[idx] = { ...row, kind: v as PermissionKind }; onChange(next); }}>
            <SelectTrigger className="min-h-[44px]" aria-label="Permission kind"><SelectValue /></SelectTrigger>
            <SelectContent>{kinds.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
          </Select>
          <Input placeholder="Key" className="min-h-[44px] sm:col-span-2"
            value={row.key}
            onChange={(e) => { const next = [...value]; next[idx] = { ...row, key: e.target.value }; onChange(next); }} />
          <Input placeholder="Label (EN)" className="min-h-[44px] sm:col-span-2"
            value={row.label_en}
            onChange={(e) => { const next = [...value]; next[idx] = { ...row, label_en: e.target.value }; onChange(next); }} />
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-1 text-xs">
              <Checkbox checked={row.is_required} onCheckedChange={(v) => { const next = [...value]; next[idx] = { ...row, is_required: v === true }; onChange(next); }} />
              Required
            </label>
            <Button size="sm" variant="ghost" className="min-h-[40px] text-red-700"
              onClick={() => onChange(value.filter((_, i) => i !== idx))}>Remove</Button>
          </div>
        </div>
      ))}
      <Button size="sm" variant="outline" className="min-h-[44px]"
        onClick={() => onChange([...value, { kind: "capability", key: "", label_en: "", is_required: false, is_public: true }])}>
        + Add permission
      </Button>
    </div>
  );
}

function ProductEditor({ value, onChange, defaultSku }: { value: ProductRow[]; onChange: (v: ProductRow[]) => void; defaultSku: string }) {
  return (
    <div className="space-y-2">
      {value.map((row, idx) => (
        <div key={idx} className="grid grid-cols-1 gap-2 rounded border border-gray-200 p-2 sm:grid-cols-5">
          <Input placeholder="SKU" className="min-h-[44px]"
            value={row.sku}
            onChange={(e) => { const next = [...value]; next[idx] = { ...row, sku: e.target.value }; onChange(next); }} />
          <Select value={row.product_type} onValueChange={(v) => { const next = [...value]; next[idx] = { ...row, product_type: v as ProductType }; onChange(next); }}>
            <SelectTrigger className="min-h-[44px]" aria-label="Product type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="individual">Individual</SelectItem>
              <SelectItem value="bundle">Bundle</SelectItem>
              {/* per-resource lifetime intentionally excluded */}
            </SelectContent>
          </Select>
          <Input placeholder="Title (EN)" className="min-h-[44px] sm:col-span-2"
            value={row.title_en}
            onChange={(e) => { const next = [...value]; next[idx] = { ...row, title_en: e.target.value }; onChange(next); }} />
          <div className="flex items-center gap-2">
            <Input inputMode="numeric" placeholder="Price (fils)" className="min-h-[44px]"
              value={row.price_fils}
              onChange={(e) => { const next = [...value]; next[idx] = { ...row, price_fils: e.target.value.replace(/\D/g, "") }; onChange(next); }} />
            <span className="whitespace-nowrap text-[11px] text-muted-foreground">
              = {(parseInt(row.price_fils || "0", 10) / 1000).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KWD
            </span>
            <Button size="sm" variant="ghost" aria-label="Remove product" className="min-h-[44px] min-w-[44px] text-red-700"
              onClick={() => onChange(value.filter((_, i) => i !== idx))}>×</Button>
          </div>
        </div>
      ))}
      <Button size="sm" variant="outline" className="min-h-[44px]"
        onClick={() => onChange([...value, { sku: defaultSku ? `${defaultSku}-${value.length + 1}` : "", product_type: "individual", title_en: "", price_fils: "0" }])}>
        + Add product
      </Button>
    </div>
  );
}
