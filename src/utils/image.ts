
// CDN helper for prompt images
export const SUPABASE_CDN = "https://fxkqgjakbyrxkmevkglv.supabase.co/storage/v1/render/image/public";

// General-purpose dynamic CDN image url builder
export function getCdnUrl(path: string | null, width = 400, quality = 80) {
  if (!path) return null;
  if (path.startsWith("http")) return path; // legacy URL
  return `${SUPABASE_CDN}/prompt-images/${path}?width=${width}&quality=${quality}`;
}
