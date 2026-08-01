export const DEFAULT_TEXT_PROMPT_IMAGE = "textpromptdefaultimg.jpg";

/**
 * Normalize a legacy Supabase Storage object path without weakening bucket
 * access. Legacy prompt rows sometimes contain URL-encoded spaces, while the
 * actual object names contain literal spaces.
 */
export function normalizeStorageObjectPath(
  value: string | null | undefined,
): string | null {
  if (!value || typeof value !== "string") return null;

  const trimmed = value.trim().replace(/^\/+/, "");
  if (!trimmed) return null;

  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    // A literal percent sign is valid in an object name. Keep the original
    // value when it is not valid URI encoding.
  }

  const normalized = decoded.replace(/^\/+/, "");
  if (!normalized || /[\u0000-\u001f\u007f]/.test(normalized)) return null;

  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "." || segment === "..")) {
    return null;
  }

  return normalized;
}

export function isDefaultTextPromptImage(path: string): boolean {
  return path === DEFAULT_TEXT_PROMPT_IMAGE;
}
