import { cloneElement, isValidElement, useEffect, useId, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, Link } from "react-router-dom";
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
import {
  readAiStudioPublisherHandoff,
  type ProtectedContentFormat,
} from "./aiStudioHandoff";

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
interface GuideStep {
  title_en: string;
  body_en: string;
  title_ar: string;
  body_ar: string;
}
interface GuideRow {
  platform_slug: string; steps: GuideStep[]; estimated_minutes: string;
}
interface PermRow { kind: PermissionKind; key: string; label_en: string; label_ar: string; is_required: boolean; is_public: boolean }
interface ProductRow { sku: string; product_type: ProductType; title_en: string; title_ar: string; price_fils: string }
interface LicenseRow { license_key: string; terms_en: string; terms_ar: string; allows_commercial: boolean; allows_redistribution: boolean }
interface EditorProduct extends Omit<ProductRow, "price_fils" | "title_ar"> {
  id: string;
  title_ar: string | null;
  price_fils: number | null;
  is_active: boolean;
}
interface EditorPlatform {
  platform_slug: string;
  min_version: string | null;
  notes_en: string | null;
  notes_ar: string | null;
  is_verified: boolean | null;
}
interface EditorGuide {
  platform_slug: string;
  steps_en: unknown;
  steps_ar: unknown;
  estimated_minutes: number | null;
}
interface EditorPermission {
  kind: PermissionKind;
  key: string;
  label_en: string | null;
  label_ar: string | null;
  is_required: boolean | null;
  is_public: boolean | null;
}
interface EditorLicense {
  license_key: string;
  terms_en: string | null;
  terms_ar: string | null;
  allows_commercial: boolean | null;
  allows_redistribution: boolean | null;
}
interface ResourceEditorRecord {
  slug: string;
  type: ResourceType;
  lifecycle: "draft" | "review" | "published" | "archived";
  latest_published_version_id: string | null;
  title_en: string;
  title_ar: string | null;
  summary_en: string | null;
  summary_ar: string | null;
  description_en: string | null;
  description_ar: string | null;
  examples_en: string | null;
  examples_ar: string | null;
  limitations_en: string | null;
  limitations_ar: string | null;
  uninstall_en: string | null;
  uninstall_ar: string | null;
  support_en: string | null;
  support_ar: string | null;
  update_info_en: string | null;
  update_info_ar: string | null;
  category: string | null;
  tags: string[];
  hero_image_path: string | null;
  effort_minutes: number | null;
  current_version_id: string | null;
  current_version: {
    version: string;
    changelog_en: string | null;
    changelog_ar: string | null;
    published_at: string | null;
  } | null;
  platform_compatibility: EditorPlatform[];
  installation_guides: EditorGuide[];
  resource_permissions: EditorPermission[];
  licenses: EditorLicense[];
  products: EditorProduct[];
}
interface AdminPrivateContent {
  ok: boolean;
  content_en?: string | null;
  content_ar?: string | null;
  content_format?: ProtectedContentFormat | null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown";
}

const standardLicense = (): LicenseRow => ({
  license_key: "jojo-standard-v1",
  terms_en:
    "Personal use and commercial use of outputs are allowed. The underlying resource files may not be redistributed, shared, or resold.",
  terms_ar:
    "يُسمح بالاستخدام الشخصي والتجاري للمخرجات. لا يجوز إعادة توزيع ملفات المورد الأساسية أو مشاركتها أو إعادة بيعها.",
  allows_commercial: true,
  allows_redistribution: false,
});

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
  version: string; changelog_en: string; changelog_ar: string; is_new_version: boolean;
  private_content_en: string; private_content_ar: string;
  private_content_format: ProtectedContentFormat;
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
  version: "1.0.0", changelog_en: "", changelog_ar: "", is_new_version: false,
  private_content_en: "", private_content_ar: "", private_content_format: "text",
  platform_compatibility: [],
  installation_guides: [],
  permissions: [],
  license: standardLicense(),
  products: [{ sku: "", product_type: "free", title_en: "", title_ar: "", price_fils: "0" }],
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
const RESOURCE_EDITOR_SELECT =
  "id, slug, type, lifecycle, latest_published_version_id, title_en, title_ar, summary_en, summary_ar, description_en, description_ar, examples_en, examples_ar, limitations_en, limitations_ar, uninstall_en, uninstall_ar, support_en, support_ar, update_info_en, update_info_ar, category, tags, hero_image_path, effort_minutes, current_version_id, platform_compatibility(*), installation_guides(*), resource_permissions(*), licenses(*), current_version:current_version_id(id,version,changelog_en,changelog_ar,published_at), products(id,sku,product_type,title_en,title_ar,price_fils,is_active)";

function buildResourceEditUrl(resourceId: string): string {
  return `/admin/content?tool=edit&resourceId=${encodeURIComponent(resourceId)}`;
}

function parseGuideSteps(value: unknown): Array<{ title: string; body: string }> {
  if (!Array.isArray(value)) return [];
  return value.map((step) => {
    if (typeof step === "string") return { title: step, body: "" };
    if (!step || typeof step !== "object") return { title: "", body: "" };
    const item = step as { title?: unknown; body?: unknown };
    return {
      title: typeof item.title === "string" ? item.title : "",
      body: typeof item.body === "string" ? item.body : "",
    };
  });
}

async function fetchResource(id: string) {
  const { data, error } = await supabase
    .from("resources")
    .select(RESOURCE_EDITOR_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const editor = data as unknown as ResourceEditorRecord;

  // Load bundle items via the resource's own bundle-typed products.
  const productIds = editor.products
    .filter((product) => product.product_type === "bundle")
    .map((product) => product.id);
  let bundleItems: { resource_id: string }[] = [];
  if (productIds.length > 0) {
    const { data: items, error: bErr } = await supabase
      .from("product_bundle_items")
      .select("resource_id")
      .in("bundle_product_id", productIds);
    if (bErr) throw bErr;
    bundleItems = items ?? [];
  }
  const { data: privateContent, error: privateContentError } =
    await supabase.rpc("admin_get_resource_private_content", {
      p_resource_id: id,
      p_version_id: null,
    });
  if (privateContentError) throw privateContentError;
  const protectedContent =
    privateContent as unknown as AdminPrivateContent | null;

  return {
    ...editor,
    product_bundle_items: bundleItems,
    private_content: protectedContent?.ok ? protectedContent : null,
  };
}

async function fetchPlatforms(): Promise<{ slug: string; name: string }[]> {
  const { data } = await supabase
    .from("platforms")
    .select("slug,name,display_order")
    .eq("is_active", true)
    .order("display_order");
  return (data ?? []).map((platform) => ({
    slug: platform.slug,
    name: platform.name,
  }));
}

interface PublisherProps {
  mode: "new" | "edit" | "new-version";
  resourceIdOverride?: string;
}

export default function ResourcePublisher({ mode, resourceIdOverride }: PublisherProps) {
  const params = useParams<{ resourceId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const resourceId = resourceIdOverride ?? params.resourceId;
  const aiStudioImport = useMemo(
    () =>
      mode === "new"
        ? readAiStudioPublisherHandoff(location.state)
        : null,
    [location.state, mode],
  );
  const [form, setForm] = useState<FormState>(() => {
    if (!aiStudioImport) return emptyForm();
    const imported = emptyForm(aiStudioImport.resource.type);
    return {
      ...imported,
      slug: aiStudioImport.resource.slug,
      title_en: aiStudioImport.resource.title_en,
      title_ar: aiStudioImport.resource.title_ar,
      summary_en: aiStudioImport.resource.summary_en,
      summary_ar: aiStudioImport.resource.summary_ar,
      description_en: aiStudioImport.resource.description_en,
      description_ar: aiStudioImport.resource.description_ar,
      tags: aiStudioImport.resource.tags.join(", "),
      hero_image_path: aiStudioImport.resource.hero_image_path,
      private_content_en: aiStudioImport.private_content.content_en,
      private_content_ar: aiStudioImport.private_content.content_ar,
      private_content_format: aiStudioImport.private_content.content_format,
      platform_compatibility: [
        {
          platform_slug: aiStudioImport.resource.platform_slug,
          min_version: "",
          notes_en: "Imported from AI Studio",
          notes_ar: "",
          is_verified: false,
        },
      ],
    };
  });
  const [dirty, setDirty] = useState(!!aiStudioImport);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [publishErrors, setPublishErrors] = useState<string[] | null>(null);
  const licenseKeyId = useId();
  const licenseTermsId = useId();
  const licenseCommercialId = useId();
  const licenseRedistributionId = useId();

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
      changelog_ar: mode === "new-version" ? "" : (existing.current_version?.changelog_ar ?? ""),
      is_new_version: mode === "new-version",
      private_content_en: existing.private_content?.content_en ?? "",
      private_content_ar: existing.private_content?.content_ar ?? "",
      private_content_format:
        (existing.private_content?.content_format as ProtectedContentFormat) ??
        "text",
      platform_compatibility: existing.platform_compatibility.map((p) => ({
        platform_slug: p.platform_slug, min_version: p.min_version ?? "",
        notes_en: p.notes_en ?? "", notes_ar: p.notes_ar ?? "",
        is_verified: !!p.is_verified,
      })),
      installation_guides: existing.installation_guides.map((g) => {
        const stepsEn = parseGuideSteps(g.steps_en);
        const stepsAr = parseGuideSteps(g.steps_ar);
        return {
          platform_slug: g.platform_slug,
          steps: Array.from(
            { length: Math.max(stepsEn.length, stepsAr.length) },
            (_, index) => ({
              title_en: stepsEn[index]?.title ?? "",
              body_en: stepsEn[index]?.body ?? "",
              title_ar: stepsAr[index]?.title ?? "",
              body_ar: stepsAr[index]?.body ?? "",
            }),
          ),
          estimated_minutes: g.estimated_minutes == null ? "" : String(g.estimated_minutes),
        };
      }),
      permissions: existing.resource_permissions.map((p) => ({
        kind: p.kind, key: p.key, label_en: p.label_en ?? "", label_ar: p.label_ar ?? "",
        is_required: !!p.is_required, is_public: p.is_public !== false,
      })),
      license: existing.licenses?.[0]
        ? {
            license_key: existing.licenses[0].license_key,
            terms_en: existing.licenses[0].terms_en ?? "",
            terms_ar: existing.licenses[0].terms_ar ?? "",
            allows_commercial: !!existing.licenses[0].allows_commercial,
            allows_redistribution: !!existing.licenses[0].allows_redistribution,
          }
        : standardLicense(),
      products: existing.products.filter((p) => p.is_active).map((p) => ({
        sku: p.sku, product_type: p.product_type, title_en: p.title_en,
        title_ar: p.title_ar ?? "", price_fils: String(p.price_fils ?? 0),
      })),
      bundle_items: existing.product_bundle_items.map((item) => item.resource_id),
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
    version: (form.version || form.changelog_en || form.changelog_ar || form.is_new_version) ? {
      version: form.version.trim() || "1.0.0",
      changelog_en: form.changelog_en || null,
      changelog_ar: form.changelog_ar || null,
      is_new_version: form.is_new_version,
    } : null,
    private_content: form.type === "bundle" ? null : {
      content_en: form.private_content_en,
      content_ar: form.private_content_ar,
      content_format: form.private_content_format,
    },
    source_ai_studio_draft_id:
      aiStudioImport?.source_ai_studio_draft_id ?? null,
    platform_compatibility: form.platform_compatibility,
    installation_guides: form.installation_guides.map((g) => ({
      platform_slug: g.platform_slug,
      steps_en: g.steps
        .filter((s) => s.title_en || s.body_en)
        .map((s) => ({ title: s.title_en, body: s.body_en })),
      steps_ar: g.steps
        .filter((s) => s.title_ar || s.body_ar)
        .map((s) => ({ title: s.title_ar, body: s.body_ar })),
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
      const { data, error } = await supabase.rpc(
        "save_admin_resource_draft_v2",
        { payload: buildPayload() },
      );
      if (error) throw error;
      const result = data as unknown as {
        ok?: boolean;
        resource_id?: string;
        slug?: string;
      };
      if (!result.ok || !result.resource_id || !result.slug) {
        throw new Error("Save failed");
      }
      return {
        ok: true as const,
        resource_id: result.resource_id,
        slug: result.slug,
      };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["admin","v2","catalog"] });
      qc.invalidateQueries({ queryKey: ["admin","v2","publisher","resource", res.resource_id] });
      toast({ title: "Draft saved", description: `/${res.slug}` });
      setDirty(false);
      if (!resourceId) {
        navigate(buildResourceEditUrl(res.resource_id), { replace: true });
      }
    },
    onError: (error: unknown) =>
      toast({
        variant: "destructive",
        title: "Save failed",
        description: errorMessage(error),
      }),
  });

  const submitReview = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc(
        "admin_transition_resource_lifecycle",
        { p_resource_id: id, p_action: "review" },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin","v2","catalog"] });
      toast({ title: "Submitted for review" });
    },
    onError: (error: unknown) =>
      toast({
        variant: "destructive",
        title: "Failed",
        description: errorMessage(error),
      }),
  });

  const publish = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("admin_publish_resource", {
        p_resource_id: id,
      });
      if (error) throw error;
      return data as unknown as { ok: boolean; errors?: string[] };
    },
    onSuccess: (res) => {
      if (!res.ok) { setPublishErrors(res.errors ?? ["unknown"]); return; }
      qc.invalidateQueries({ queryKey: ["admin","v2","catalog"] });
      qc.invalidateQueries({ queryKey: ["admin","v2","overview"] });
      toast({ title: "Published" });
    },
    onError: (error: unknown) =>
      toast({
        variant: "destructive",
        title: "Publish failed",
        description: errorMessage(error),
      }),
  });

  // Client-side publish gates. Server remains authoritative.
  const clientPublishGates = (): string[] => {
    const gates: string[] = [];
    if (!form.title_en.trim()) gates.push("Title (EN) is required to publish.");
    if (!form.summary_en.trim()) gates.push("Summary (EN) is required to publish.");
    if (!form.description_en.trim()) gates.push("Description (EN) is required to publish.");
    if (
      ["prompt", "prompt_pack", "image_style"].includes(form.type) &&
      !form.private_content_en.trim() &&
      !form.private_content_ar.trim()
    ) {
      gates.push("Protected delivery content is required for this resource type.");
    }
    if (form.type === "skill" || form.type === "automation") {
      if (form.platform_compatibility.length === 0) gates.push("At least one platform compatibility entry is required.");
      if (form.installation_guides.length === 0) gates.push("At least one installation guide is required.");
      if (!form.limitations_en.trim()) gates.push("Limitations (EN) are required for skills and automations.");
      if (!form.uninstall_en.trim()) gates.push("Uninstall guidance (EN) is required for skills and automations.");
    }
    if (!form.version.trim()) gates.push("Version is required.");
    if (!/^[0-9]+\.[0-9]+\.[0-9]+([.\-+][A-Za-z0-9._-]+)?$/.test(form.version.trim())) {
      gates.push("Version must look like 1.0.0.");
    }
    if (!form.license.license_key.trim() || !form.license.terms_en.trim()) {
      gates.push("A license key and English license terms are required.");
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
  const isArchived = existing?.lifecycle === "archived";
  const canSubmitReview = !resourceId || existing?.lifecycle === "draft";
  const canPublish = !isArchived;
  const hasPublishedVersion = Boolean(
    existing?.latest_published_version_id,
  );
  const disabledSave =
    busy ||
    isArchived ||
    (!dirty && !!resourceId && mode !== "new-version");

  const supportsPackage = form.type === "skill" || form.type === "automation";
  const requiresPackage = form.type === "skill";

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
          <Button variant="outline" size="sm" onClick={() => navigate("/admin/content")}>Back to Catalog</Button>
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
        <Button variant="outline" size="sm" onClick={() => navigate("/admin/content")}>
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
          {resourceId && hasPublishedVersion ? (
            <Button asChild variant="outline" size="sm" className="min-h-[44px]">
              <Link to={`/resources/${form.slug || ""}`} target="_blank" rel="noreferrer">
                <ExternalLink className="me-1.5 h-3.5 w-3.5" /> Preview public
              </Link>
            </Button>
          ) : null}
          {canSubmitReview ? (
            <Button variant="outline" size="sm" className="min-h-[44px]" onClick={onSubmit} disabled={busy}>
              <ClipboardCheck className="me-1.5 h-3.5 w-3.5" /> Submit for review
            </Button>
          ) : null}
          {canPublish ? (
            <Button size="sm" className="min-h-[44px] bg-warm-gold text-dark-base hover:bg-warm-gold/90" onClick={onPublish} disabled={busy}>
              <Send className="me-1.5 h-3.5 w-3.5" /> Publish
            </Button>
          ) : null}
          <Button size="sm" className="min-h-[44px]" onClick={onSave} disabled={disabledSave}>
            {saveDraft.isPending ? <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="me-1.5 h-3.5 w-3.5" />}
            Save draft
          </Button>
        </div>
      </header>

      {isArchived ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          This resource is archived. Restore it from Catalog before editing or
          publishing another version.
        </div>
      ) : null}

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

      <Accordion type="multiple" defaultValue={["type","meta","content","platforms","commerce"]} className="space-y-2">
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
                    <Link to="/admin/content?tool=import-json"><ExternalLink className="me-1.5 h-3.5 w-3.5" /> JSON Importer</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="min-h-[44px]">
                    <Link to="/admin/content?tool=ai-studio"><ExternalLink className="me-1.5 h-3.5 w-3.5" /> AI Studio</Link>
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
              <div className="space-y-3 rounded-lg border bg-muted/20 p-4 md:col-span-2">
                <div>
                  <h3 className="text-sm font-semibold">Usage, limitations & support</h3>
                  <p className="text-xs text-muted-foreground">
                    These fields appear on the public resource detail page and in My Library.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Field label="Examples (EN)">
                    <Textarea value={form.examples_en} onChange={(e) => patch({ examples_en: e.target.value })} rows={3} />
                  </Field>
                  <Field label="Examples (AR)" dir="rtl">
                    <Textarea value={form.examples_ar} onChange={(e) => patch({ examples_ar: e.target.value })} rows={3} className="text-right" dir="rtl" />
                  </Field>
                  <Field label="Limitations (EN)">
                    <Textarea value={form.limitations_en} onChange={(e) => patch({ limitations_en: e.target.value })} rows={3} />
                  </Field>
                  <Field label="Limitations (AR)" dir="rtl">
                    <Textarea value={form.limitations_ar} onChange={(e) => patch({ limitations_ar: e.target.value })} rows={3} className="text-right" dir="rtl" />
                  </Field>
                  <Field label="Uninstall guidance (EN)">
                    <Textarea value={form.uninstall_en} onChange={(e) => patch({ uninstall_en: e.target.value })} rows={3} />
                  </Field>
                  <Field label="Uninstall guidance (AR)" dir="rtl">
                    <Textarea value={form.uninstall_ar} onChange={(e) => patch({ uninstall_ar: e.target.value })} rows={3} className="text-right" dir="rtl" />
                  </Field>
                  <Field label="Support information (EN)">
                    <Textarea value={form.support_en} onChange={(e) => patch({ support_en: e.target.value })} rows={2} />
                  </Field>
                  <Field label="Support information (AR)" dir="rtl">
                    <Textarea value={form.support_ar} onChange={(e) => patch({ support_ar: e.target.value })} rows={2} className="text-right" dir="rtl" />
                  </Field>
                  <Field label="Update information (EN)">
                    <Textarea value={form.update_info_en} onChange={(e) => patch({ update_info_en: e.target.value })} rows={2} />
                  </Field>
                  <Field label="Update information (AR)" dir="rtl">
                    <Textarea value={form.update_info_ar} onChange={(e) => patch({ update_info_ar: e.target.value })} rows={2} className="text-right" dir="rtl" />
                  </Field>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Protected delivery content */}
        {form.type !== "bundle" ? (
          <AccordionItem value="content">
            <AccordionTrigger className="text-sm font-semibold">
              3 · Protected delivery content
              {["prompt", "prompt_pack", "image_style"].includes(form.type) ? (
                <Badge className="ms-2" variant="secondary">
                  required for publish
                </Badge>
              ) : form.type === "automation" ? (
                <Badge className="ms-2" variant="outline">
                  content or package required
                </Badge>
              ) : null}
            </AccordionTrigger>
            <AccordionContent>
              <div className="rounded-md border border-warm-gold/30 bg-warm-gold/5 p-3">
                <p className="mb-3 text-xs text-muted-foreground">
                  This content is stored per version outside the public Data API.
                  Only entitled customers and admins can retrieve it. Publishing
                  freezes the version; later edits require a new version.
                </p>
                <div className="mb-3 max-w-xs">
                  <Label htmlFor="private-content-format">Content format</Label>
                  <Select
                    value={form.private_content_format}
                    onValueChange={(value) =>
                      patch({
                        private_content_format:
                          value as ProtectedContentFormat,
                      })
                    }
                  >
                    <SelectTrigger
                      id="private-content-format"
                      className="min-h-[44px]"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Plain text</SelectItem>
                      <SelectItem value="markdown">Markdown</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                      <SelectItem value="yaml">YAML</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Field label="Protected content (EN)">
                    <Textarea
                      value={form.private_content_en}
                      onChange={(event) =>
                        patch({ private_content_en: event.target.value })
                      }
                      rows={12}
                      spellCheck={false}
                      className="font-mono text-xs"
                    />
                  </Field>
                  <Field label="Protected content (AR)" dir="rtl">
                    <Textarea
                      value={form.private_content_ar}
                      onChange={(event) =>
                        patch({ private_content_ar: event.target.value })
                      }
                      rows={12}
                      spellCheck={false}
                      dir="rtl"
                      className="text-right font-mono text-xs"
                    />
                  </Field>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        ) : null}

        {/* Platforms */}
        <AccordionItem value="platforms">
          <AccordionTrigger className="text-sm font-semibold">
            4 · Platform compatibility {supportsPackage ? <Badge className="ms-2" variant="secondary">required for publish</Badge> : null}
          </AccordionTrigger>
          <AccordionContent>
            <PlatformEditor
              platforms={platforms}
              value={form.platform_compatibility}
              onChange={(v) => patch({ platform_compatibility: v })}
            />
            <div className="mt-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Version">
                  <Input value={form.version} onChange={(e) => patch({ version: e.target.value })} className="min-h-[44px]" placeholder="1.0.0" />
                </Field>
                <div className="hidden sm:block" aria-hidden />
                <Field label="Changelog (EN)">
                  <Textarea value={form.changelog_en} onChange={(e) => patch({ changelog_en: e.target.value })} rows={2} placeholder="Changelog (EN)" />
                </Field>
                <Field label="Changelog (AR)" dir="rtl">
                  <Textarea value={form.changelog_ar} onChange={(e) => patch({ changelog_ar: e.target.value })} rows={2} placeholder="سجل التغييرات (AR)" className="text-right" dir="rtl" />
                </Field>
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
          <AccordionTrigger className="text-sm font-semibold">5 · Permissions / dependencies</AccordionTrigger>
          <AccordionContent>
            <PermissionEditor value={form.permissions} onChange={(v) => patch({ permissions: v })} />
          </AccordionContent>
        </AccordionItem>

        {/* Guides & license */}
        <AccordionItem value="guides">
          <AccordionTrigger className="text-sm font-semibold">
            6 · Installation guides {supportsPackage ? <Badge className="ms-2" variant="secondary">required for publish</Badge> : null}
          </AccordionTrigger>
          <AccordionContent>
            <GuideEditor platforms={platforms} value={form.installation_guides} onChange={(v) => patch({ installation_guides: v })} />
            <div className="mt-4 border-t pt-4">
              <h3 className="mb-2 text-sm font-semibold">License</h3>
              <p className="mb-3 text-xs text-muted-foreground">
                V2.0 defaults to the Jojo Standard License: outputs may be used
                commercially, but the underlying files may not be redistributed.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={licenseKeyId}>License key</Label>
                  <Input
                    id={licenseKeyId}
                    placeholder="jojo-standard-v1"
                    className="min-h-[44px]"
                    value={form.license.license_key}
                    onChange={(e) => patch({ license: { ...form.license, license_key: e.target.value } })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={licenseTermsId}>License terms (English)</Label>
                  <Textarea
                    id={licenseTermsId}
                    placeholder="Terms (EN)"
                    rows={2}
                    value={form.license.terms_en}
                    onChange={(e) => patch({ license: { ...form.license, terms_en: e.target.value } })}
                  />
                </div>
                <div className="space-y-1.5 sm:col-start-2">
                  <Label htmlFor={`${licenseTermsId}-ar`}>License terms (Arabic)</Label>
                  <Textarea
                    id={`${licenseTermsId}-ar`}
                    placeholder="شروط الترخيص"
                    rows={2}
                    value={form.license.terms_ar}
                    onChange={(e) => patch({ license: { ...form.license, terms_ar: e.target.value } })}
                    className="text-right"
                    dir="rtl"
                  />
                </div>
                <Label
                  htmlFor={licenseCommercialId}
                  className="inline-flex min-h-[44px] items-center gap-2 text-sm"
                >
                  <Checkbox
                    id={licenseCommercialId}
                    checked={form.license.allows_commercial}
                    onCheckedChange={(v) => patch({ license: { ...form.license, allows_commercial: v === true } })} />
                  Allows commercial use
                </Label>
                <Label
                  htmlFor={licenseRedistributionId}
                  className="inline-flex min-h-[44px] items-center gap-2 text-sm"
                >
                  <Checkbox
                    id={licenseRedistributionId}
                    checked={form.license.allows_redistribution}
                    onCheckedChange={(v) => patch({ license: { ...form.license, allows_redistribution: v === true } })} />
                  Allows redistribution
                </Label>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Commerce */}
        <AccordionItem value="commerce">
          <AccordionTrigger className="text-sm font-semibold">7 · Commerce</AccordionTrigger>
          <AccordionContent>
            <p className="mb-2 text-xs text-muted-foreground">{TYPE_PRICE_HINT[form.type]}</p>
            <p className="mb-3 text-xs text-warm-gold">Every eligible resource is included with the 30.000 KWD Lifetime pass.</p>
            <ProductEditor value={form.products} onChange={(v) => patch({ products: v })} defaultSku={form.slug} />
            {form.type === "bundle" ? (
              <div className="mt-3 border-t pt-3">
                <Field label="Bundle items (resource IDs)">
                  <Textarea rows={3} placeholder="One UUID per line" value={form.bundle_items.join("\n")}
                    onChange={(e) => patch({ bundle_items: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} />
                </Field>
              </div>
            ) : null}
          </AccordionContent>
        </AccordionItem>

        {/* Package upload — skill/automation only, after first save creates a version */}
        {supportsPackage ? (
          <AccordionItem value="package">
            <AccordionTrigger>
              8 · Package files & scan
              {requiresPackage ? (
                <Badge className="ms-2" variant="secondary">
                  required for skills
                </Badge>
              ) : (
                <Badge className="ms-2" variant="outline">
                  optional for automations
                </Badge>
              )}
            </AccordionTrigger>
            <AccordionContent>
              {!resourceId ||
              !existing?.current_version_id ||
              existing.current_version?.published_at ? (
                <p className="text-sm text-muted-foreground">
                  Save the draft first — uploads can only attach to an
                  unpublished working version. Published packages are
                  immutable.
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
          <Input placeholder="Min version" aria-label={`Platform ${idx + 1} minimum version`} className="min-h-[44px]"
            value={row.min_version}
            onChange={(e) => { const next = [...value]; next[idx] = { ...row, min_version: e.target.value }; onChange(next); }} />
          <div className="flex items-center gap-2 sm:col-span-3">
            <label className="inline-flex items-center gap-1 text-xs">
              <Checkbox checked={row.is_verified}
                onCheckedChange={(v) => { const next = [...value]; next[idx] = { ...row, is_verified: v === true }; onChange(next); }} />
              Verified
            </label>
            <Button size="sm" variant="ghost" className="min-h-[44px] text-red-700"
              onClick={() => onChange(value.filter((_, i) => i !== idx))}>Remove</Button>
          </div>
          <Input placeholder="Notes (EN)" aria-label={`Platform ${idx + 1} notes in English`} className="min-h-[44px] sm:col-span-3"
            value={row.notes_en}
            onChange={(e) => { const next = [...value]; next[idx] = { ...row, notes_en: e.target.value }; onChange(next); }} />
          <Input placeholder="ملاحظات المنصة (AR)" aria-label={`Platform ${idx + 1} notes in Arabic`} className="min-h-[44px] text-right sm:col-span-3"
            dir="rtl"
            value={row.notes_ar}
            onChange={(e) => { const next = [...value]; next[idx] = { ...row, notes_ar: e.target.value }; onChange(next); }} />
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
            <Input placeholder="Estimated minutes" aria-label={`Guide ${idx + 1} estimated minutes`} className="min-h-[44px]"
              value={row.estimated_minutes}
              onChange={(e) => { const next = [...value]; next[idx] = { ...row, estimated_minutes: e.target.value.replace(/\D/g, "") }; onChange(next); }} />
            <Button size="sm" variant="ghost" className="min-h-[44px] text-red-700"
              onClick={() => onChange(value.filter((_, i) => i !== idx))}>Remove guide</Button>
          </div>
          <div className="mt-2 space-y-2">
            {row.steps.map((s, si) => (
              <div key={si} className="grid grid-cols-1 gap-3 rounded-md bg-muted/30 p-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Input placeholder={`Step ${si + 1} title (EN)`} aria-label={`Guide ${idx + 1} step ${si + 1} title in English`} className="min-h-[44px]"
                  value={s.title_en}
                  onChange={(e) => {
                    const next = [...value];
                    const steps = [...row.steps]; steps[si] = { ...s, title_en: e.target.value };
                    next[idx] = { ...row, steps }; onChange(next);
                  }} />
                  <Textarea placeholder="Instructions (EN)" aria-label={`Guide ${idx + 1} step ${si + 1} instructions in English`} rows={3}
                  value={s.body_en}
                  onChange={(e) => {
                    const next = [...value];
                    const steps = [...row.steps]; steps[si] = { ...s, body_en: e.target.value };
                    next[idx] = { ...row, steps }; onChange(next);
                  }} />
                </div>
                <div className="space-y-2" dir="rtl">
                  <Input placeholder={`عنوان الخطوة ${si + 1} (AR)`} aria-label={`Guide ${idx + 1} step ${si + 1} title in Arabic`} className="min-h-[44px] text-right"
                    value={s.title_ar}
                    onChange={(e) => {
                      const next = [...value];
                      const steps = [...row.steps]; steps[si] = { ...s, title_ar: e.target.value };
                      next[idx] = { ...row, steps }; onChange(next);
                    }} />
                  <Textarea placeholder="التعليمات (AR)" aria-label={`Guide ${idx + 1} step ${si + 1} instructions in Arabic`} className="text-right" rows={3}
                    value={s.body_ar}
                    onChange={(e) => {
                      const next = [...value];
                      const steps = [...row.steps]; steps[si] = { ...s, body_ar: e.target.value };
                      next[idx] = { ...row, steps }; onChange(next);
                    }} />
                </div>
              </div>
            ))}
            <Button size="sm" variant="outline" className="min-h-[44px]"
              onClick={() => {
                const next = [...value]; next[idx] = {
                  ...row,
                  steps: [...row.steps, {
                    title_en: "",
                    body_en: "",
                    title_ar: "",
                    body_ar: "",
                  }],
                }; onChange(next);
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
          <Input placeholder="Key" aria-label={`Permission ${idx + 1} key`} className="min-h-[44px] sm:col-span-2"
            value={row.key}
            onChange={(e) => { const next = [...value]; next[idx] = { ...row, key: e.target.value }; onChange(next); }} />
          <Input placeholder="Label (EN)" aria-label={`Permission ${idx + 1} label in English`} className="min-h-[44px]"
            value={row.label_en}
            onChange={(e) => { const next = [...value]; next[idx] = { ...row, label_en: e.target.value }; onChange(next); }} />
          <Input placeholder="التسمية (AR)" aria-label={`Permission ${idx + 1} label in Arabic`} className="min-h-[44px] text-right"
            dir="rtl"
            value={row.label_ar}
            onChange={(e) => { const next = [...value]; next[idx] = { ...row, label_ar: e.target.value }; onChange(next); }} />
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-1 text-xs">
              <Checkbox checked={row.is_required} onCheckedChange={(v) => { const next = [...value]; next[idx] = { ...row, is_required: v === true }; onChange(next); }} />
              Required
            </label>
            <Button size="sm" variant="ghost" className="min-h-[44px] text-red-700"
              onClick={() => onChange(value.filter((_, i) => i !== idx))}>Remove</Button>
          </div>
        </div>
      ))}
      <Button size="sm" variant="outline" className="min-h-[44px]"
        onClick={() => onChange([...value, { kind: "capability", key: "", label_en: "", label_ar: "", is_required: false, is_public: true }])}>
        + Add permission
      </Button>
    </div>
  );
}

function ProductEditor({ value, onChange, defaultSku }: { value: ProductRow[]; onChange: (v: ProductRow[]) => void; defaultSku: string }) {
  return (
    <div className="space-y-2">
      {value.map((row, idx) => (
        <div key={idx} className="grid grid-cols-1 gap-2 rounded border border-gray-200 p-2 sm:grid-cols-6">
          <Input placeholder="SKU" aria-label={`Product ${idx + 1} SKU`} className="min-h-[44px]"
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
          <Input placeholder="Title (EN)" aria-label={`Product ${idx + 1} title in English`} className="min-h-[44px]"
            value={row.title_en}
            onChange={(e) => { const next = [...value]; next[idx] = { ...row, title_en: e.target.value }; onChange(next); }} />
          <Input placeholder="العنوان (AR)" aria-label={`Product ${idx + 1} title in Arabic`} className="min-h-[44px] text-right"
            dir="rtl"
            value={row.title_ar}
            onChange={(e) => { const next = [...value]; next[idx] = { ...row, title_ar: e.target.value }; onChange(next); }} />
          <div className="flex items-center gap-2 sm:col-span-2">
            <Input inputMode="numeric" placeholder="Price (fils)" aria-label={`Product ${idx + 1} price in fils`} className="min-h-[44px]"
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
        onClick={() => onChange([...value, { sku: defaultSku ? `${defaultSku}-${value.length + 1}` : "", product_type: "individual", title_en: "", title_ar: "", price_fils: "0" }])}>
        + Add product
      </Button>
    </div>
  );
}
