import type {
  AiAssetKind,
  AiAssetPayload,
  AiStudioDraft,
} from "../ai-studio/types";

export type PublisherResourceType =
  | "skill"
  | "automation"
  | "prompt"
  | "prompt_pack"
  | "image_style"
  | "bundle";

export type ProtectedContentFormat = "text" | "markdown" | "json" | "yaml";

export interface AiStudioPublisherHandoff {
  source: "ai-studio";
  source_ai_studio_draft_id: string;
  resource: {
    type: PublisherResourceType;
    slug: string;
    title_en: string;
    title_ar: string;
    summary_en: string;
    summary_ar: string;
    description_en: string;
    description_ar: string;
    tags: string[];
    hero_image_path: string;
    platform_slug: string;
  };
  private_content: {
    content_en: string;
    content_ar: string;
    content_format: ProtectedContentFormat;
  };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mapKindToResourceType(kind: AiAssetKind): PublisherResourceType {
  switch (kind) {
    case "skill":
      return "skill";
    case "workflow":
    case "json":
      return "automation";
    case "image":
      return "image_style";
    default:
      return "prompt";
  }
}

function normalizedPlatform(targetLlm: string): string {
  const value = targetLlm.trim().toLowerCase();
  return ["chatgpt", "claude", "codex", "gemini", "hermes", "kimi"].includes(
    value,
  )
    ? value
    : "generic";
}

function slugFromTitle(title: string, draftId: string): string {
  const slug = title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/g, "");
  return slug.length >= 3 ? slug : `ai-resource-${draftId.slice(0, 8)}`;
}

function serializeAsset(asset: AiAssetPayload): {
  body: string;
  format: ProtectedContentFormat;
} {
  if (asset.json && typeof asset.json === "object") {
    const json = JSON.stringify(asset.json, null, 2);
    if (asset.body?.trim()) {
      return {
        body: `${asset.body.trim()}\n\n\`\`\`json\n${json}\n\`\`\``,
        format: "markdown",
      };
    }
    return { body: json, format: "json" };
  }
  return { body: asset.body?.trim() ?? "", format: "text" };
}

export function buildAiStudioPublisherHandoff(input: {
  draft: AiStudioDraft;
  asset: AiAssetPayload;
  kind: AiAssetKind;
  targetLlm: string;
  title: string;
  description: string;
  tags: string[];
  language: "en" | "ar" | "bilingual";
}): AiStudioPublisherHandoff {
  const type = mapKindToResourceType(input.kind);
  const title = input.title.trim();
  const description = input.description.trim();
  const serialized = serializeAsset(input.asset);
  const isArabic = input.language === "ar";
  const isBilingual = input.language === "bilingual";

  return {
    source: "ai-studio",
    source_ai_studio_draft_id: input.draft.id,
    resource: {
      type,
      slug: slugFromTitle(title, input.draft.id),
      // The unified publisher requires an English primary title. Admins can
      // correct/transliterate it before saving when the source is Arabic-only.
      title_en: title,
      title_ar: isArabic || isBilingual ? title : "",
      summary_en: description,
      summary_ar: isArabic || isBilingual ? description : "",
      description_en: description,
      description_ar: isArabic || isBilingual ? description : "",
      tags: input.tags.map((tag) => tag.trim()).filter(Boolean),
      hero_image_path: input.draft.thumbnail_path ?? "",
      platform_slug: normalizedPlatform(input.targetLlm),
    },
    private_content: {
      content_en: isArabic ? "" : serialized.body,
      content_ar: isArabic || isBilingual ? serialized.body : "",
      content_format: serialized.format,
    },
  };
}

export function readAiStudioPublisherHandoff(
  state: unknown,
): AiStudioPublisherHandoff | null {
  if (!state || typeof state !== "object") return null;
  const candidate = (state as { aiStudioImport?: unknown }).aiStudioImport;
  if (!candidate || typeof candidate !== "object") return null;
  const handoff = candidate as Partial<AiStudioPublisherHandoff>;
  if (
    handoff.source !== "ai-studio" ||
    typeof handoff.source_ai_studio_draft_id !== "string" ||
    !UUID_RE.test(handoff.source_ai_studio_draft_id) ||
    !handoff.resource ||
    typeof handoff.resource !== "object" ||
    !handoff.private_content ||
    typeof handoff.private_content !== "object"
  ) {
    return null;
  }
  return handoff as AiStudioPublisherHandoff;
}
