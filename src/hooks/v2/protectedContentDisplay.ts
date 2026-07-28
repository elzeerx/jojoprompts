/**
 * Pure helpers for selecting and gating protected version content.
 * Extracted for unit testing. NO React or Supabase imports here.
 */

export type ProtectedContentLang = "en" | "ar";

export interface ProtectedContentShape {
  ok?: boolean;
  prompt_text?: string | null;
  prompt_text_ar?: string | null;
}

/**
 * Pick the displayable protected text with a bilingual fallback:
 * requested language first, then the other language. Returns null
 * when content is unavailable, not ok, or both languages are empty.
 * The same value MUST drive rendering, Copy-button visibility, and
 * clipboard payload so the three never disagree.
 */
export function pickProtectedText(
  content: ProtectedContentShape | null | undefined,
  lang: ProtectedContentLang,
): string | null {
  if (!content || content.ok !== true) return null;
  const primary = lang === "ar" ? content.prompt_text_ar : content.prompt_text;
  const secondary = lang === "ar" ? content.prompt_text : content.prompt_text_ar;
  const first = typeof primary === "string" && primary.length > 0 ? primary : null;
  if (first) return first;
  const second =
    typeof secondary === "string" && secondary.length > 0 ? secondary : null;
  return second;
}

/**
 * Fail-closed gate: only fetch protected text delivery for a signed-in owner
 * and a resource type that can carry protected inline content. Package-only
 * skills/automations are identified by the RPC and use signed downloads;
 * bundles have no standalone protected body.
 */
export function shouldRevealProtectedContent(params: {
  hasUser: boolean;
  owned: boolean;
  resourceType: string | null | undefined;
}): boolean {
  const inlineTypes = new Set([
    "prompt",
    "prompt_pack",
    "image_style",
    "automation",
    "skill",
  ]);
  return (
    params.hasUser === true &&
    params.owned === true &&
    typeof params.resourceType === "string" &&
    inlineTypes.has(params.resourceType)
  );
}
