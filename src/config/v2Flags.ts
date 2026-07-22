/**
 * V2 feature flags. Keep V2 commerce (cart/checkout) OFF until the paid flow
 * is ready. Free acquisition is not commerce and is always on.
 */
export const V2_COMMERCE_ENABLED = false;

export const V2_RESOURCE_TYPES = [
  "skill",
  "automation",
  "prompt",
  "image_style",
  "bundle",
] as const;
export type V2ResourceType = (typeof V2_RESOURCE_TYPES)[number];

export const V2_TYPE_ROUTE: Record<V2ResourceType, string> = {
  skill: "/skills",
  automation: "/automations",
  prompt: "/prompts",
  image_style: "/image-styles",
  bundle: "/bundles",
};

export const V2_PLATFORMS = [
  "claude",
  "chatgpt",
  "codex",
  "gemini",
  "hermes",
  "kimi",
  "generic",
] as const;
export type V2Platform = (typeof V2_PLATFORMS)[number];

export const LIFETIME_THRESHOLD_FILS = 30_000;

export function formatKwd(fils: number | null | undefined): string {
  const v = Math.max(0, Math.round(Number(fils ?? 0)));
  return (v / 1000).toFixed(3);
}
