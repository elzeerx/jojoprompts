/**
 * Pure V2 Resource JSON Importer contract.
 * No React, no Supabase, no DOM — safe for pure unit tests.
 */
import { z } from "zod";

export const V2_RESOURCE_TYPES = [
  "skill", "automation", "prompt", "prompt_pack", "image_style", "bundle",
] as const;
export type V2ResourceType = typeof V2_RESOURCE_TYPES[number];

export const V2_PRODUCT_TYPES = ["free", "individual", "bundle"] as const;

export const FORBIDDEN_TOP_LEVEL_FIELDS = [
  "id", "resource_id", "owner", "owner_id", "user_id", "author_id",
  "is_active", "is_published", "published_at", "lifecycle", "lifecycle_state",
  "current_version_id", "current_version",
  "entitlement", "entitlements", "entitlement_scope",
  "scan_state", "scan_status", "package_scan",
  "created_at", "updated_at",
] as const;

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const platformSchema = z.object({
  platform_slug: z.string().min(1),
  min_version: z.string().optional().default(""),
  notes_en: z.string().optional().default(""),
  notes_ar: z.string().optional().default(""),
  is_verified: z.boolean().optional().default(false),
});

const productSchema = z.object({
  sku: z.string().min(1),
  product_type: z.enum(V2_PRODUCT_TYPES),
  title_en: z.string().min(1),
  price_fils: z.number().int().nonnegative(),
});

export const v2ResourceDraftSchema = z.object({
  slug: z.string().min(3).max(80).regex(SLUG_RE, "slug must be kebab-case"),
  type: z.enum(V2_RESOURCE_TYPES),
  title_en: z.string().min(2).max(140),
  title_ar: z.string().max(140).optional().default(""),
  summary_en: z.string().max(280).optional().default(""),
  summary_ar: z.string().max(280).optional().default(""),
  description_en: z.string().max(20000).optional().default(""),
  description_ar: z.string().max(20000).optional().default(""),
  category: z.string().max(80).optional().default(""),
  tags: z.array(z.string()).max(50).optional().default([]),
  hero_image_path: z.string().max(400).optional().default(""),
  effort_minutes: z.number().int().nonnegative().optional(),
  version: z.string().max(40).optional().default("1.0.0"),
  changelog_en: z.string().max(4000).optional().default(""),
  platform_compatibility: z.array(platformSchema).optional().default([]),
  products: z.array(productSchema).optional().default([]),
  bundle_items: z.array(z.string()).optional().default([]),
});

export type V2ResourceDraftInput = z.infer<typeof v2ResourceDraftSchema>;

export function slugify(s: string): string {
  return s.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "imported-prompt";
}

export function mapLegacyPromptToV2Draft(raw: any): V2ResourceDraftInput | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const hasLegacyContent = typeof raw.content === "string" && raw.content.trim().length > 0;
  const hasV2Type = typeof raw.type === "string";
  if (!hasLegacyContent || hasV2Type) return null;
  const title = typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : "Imported Prompt";
  const description = typeof raw.description === "string" ? raw.description.trim() : "";
  const tags = Array.isArray(raw.tags) ? raw.tags.filter((t: any) => typeof t === "string") : [];
  return {
    slug: slugify(title),
    type: "prompt",
    title_en: title,
    title_ar: "",
    summary_en: description.slice(0, 280),
    summary_ar: "",
    description_en: raw.content,
    description_ar: "",
    category: "",
    tags,
    hero_image_path: "",
    version: "1.0.0",
    changelog_en: "Imported from legacy prompt JSON.",
    platform_compatibility: [],
    products: [],
    bundle_items: [],
  };
}

export interface RowValidation {
  index: number;
  ok: boolean;
  errors: string[];
  warnings: string[];
  fromLegacy: boolean;
  draft?: V2ResourceDraftInput;
  rawTitle: string;
}

export function validateRow(raw: unknown, index: number): RowValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { index, ok: false, errors: ["Item must be a JSON object."], warnings, fromLegacy: false, rawTitle: `#${index + 1}` };
  }
  const obj = raw as Record<string, unknown>;

  const rejected = FORBIDDEN_TOP_LEVEL_FIELDS.filter((k) => k in obj);
  if (rejected.length > 0) {
    errors.push(`Rejected privileged field(s): ${rejected.join(", ")}.`);
  }

  let fromLegacy = false;
  let candidate: any = obj;
  const mapped = mapLegacyPromptToV2Draft(obj);
  if (mapped) {
    fromLegacy = true;
    candidate = mapped;
    warnings.push("Mapped from legacy prompt JSON to V2 `prompt` draft.");
  }

  if (typeof candidate.tags === "string") {
    candidate = { ...candidate, tags: candidate.tags.split(",").map((t: string) => t.trim()).filter(Boolean) };
  }
  if (Array.isArray(candidate.products)) {
    candidate = {
      ...candidate,
      products: candidate.products.map((p: any) => ({
        ...p,
        price_fils: typeof p?.price_fils === "number"
          ? p.price_fils
          : parseInt(String(p?.price_fils ?? "0"), 10) || 0,
      })),
    };
  }

  const parsed = v2ResourceDraftSchema.safeParse(candidate);
  const rawTitle = (candidate.title_en as string) || (obj.title as string) || `#${index + 1}`;

  if (!parsed.success) {
    parsed.error.issues.forEach((i) => errors.push(`${i.path.join(".") || "(root)"}: ${i.message}`));
    return { index, ok: false, errors, warnings, fromLegacy, rawTitle };
  }

  const d = parsed.data;
  for (const p of d.products ?? []) {
    if (p.product_type === "free" && p.price_fils !== 0) {
      errors.push(`Product ${p.sku}: free product must have price_fils = 0.`);
    }
    if (p.product_type !== "free" && p.price_fils <= 0) {
      errors.push(`Product ${p.sku}: paid product must have positive price_fils.`);
    }
    if (d.type === "bundle" && p.product_type === "individual") {
      errors.push(`Product ${p.sku}: bundle resources cannot have individual products.`);
    }
    if (d.type !== "bundle" && p.product_type === "bundle") {
      errors.push(`Product ${p.sku}: only bundle resources may use product_type=bundle.`);
    }
  }

  return { index, ok: errors.length === 0, errors, warnings, fromLegacy, draft: d, rawTitle };
}

export function buildDraftPayload(d: V2ResourceDraftInput) {
  return {
    resource_id: null as string | null,
    resource: {
      slug: d.slug.trim(),
      type: d.type,
      title_en: d.title_en.trim(),
      title_ar: d.title_ar?.trim() || null,
      summary_en: d.summary_en?.trim() || null,
      summary_ar: d.summary_ar?.trim() || null,
      description_en: d.description_en?.trim() || null,
      description_ar: d.description_ar?.trim() || null,
      category: d.category?.trim() || null,
      tags: (d.tags ?? []).map((t) => t.trim()).filter(Boolean),
      hero_image_path: d.hero_image_path?.trim() || null,
      effort_minutes: d.effort_minutes ?? null,
    },
    version: {
      version: (d.version || "1.0.0").trim(),
      changelog_en: d.changelog_en || null,
      is_new_version: false,
    },
    platform_compatibility: d.platform_compatibility ?? [],
    installation_guides: [],
    permissions: [],
    license: null,
    products: (d.products ?? []).map((p) => ({
      sku: p.sku,
      product_type: p.product_type,
      title_en: p.title_en,
      price_fils: Math.max(0, Math.trunc(p.price_fils)),
      currency: "KWD",
    })),
    bundle_items: d.type === "bundle" ? (d.bundle_items ?? []) : [],
  };
}

export const V2_SAMPLE_JSON = JSON.stringify(
  [
    {
      slug: "example-skill",
      type: "skill",
      title_en: "Example Skill",
      title_ar: "مهارة تجريبية",
      summary_en: "A concise description.",
      description_en: "Full description body...",
      category: "productivity",
      tags: ["example", "demo"],
      version: "1.0.0",
      products: [{ sku: "example-skill-free", product_type: "free", title_en: "Free tier", price_fils: 0 }],
    },
    {
      title: "Legacy prompt example",
      content: "Write a haiku about {topic}.",
      description: "Short haiku generator",
      tags: ["poetry"],
    },
  ],
  null,
  2,
);
