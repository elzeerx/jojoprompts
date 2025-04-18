
export const SUPABASE_CDN = "https://fxkqgjakbyrxkmevkglv.supabase.co/storage/v1/render/image/public";

export function cdnUrl(path: string | null, w = 400, q = 80) {
  if (!path) return null;
  if (path.startsWith("http")) return path;  // legacy full URL
  return `${SUPABASE_CDN}/prompt-images/${path}?width=${w}&quality=${q}`;
}
