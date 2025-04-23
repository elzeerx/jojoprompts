
// CDN helper for prompt images
export const SUPABASE_CDN = "https://fxkqgjakbyrxkmevkglv.supabase.co/storage/v1/render/image/public";

// General-purpose dynamic CDN image url builder
export function getCdnUrl(path: string | null, width = 400, quality = 80) {
  if (!path) return null;
  
  // Handle legacy URLs (already complete URLs)
  if (path.startsWith("http")) return path;
  
  // Clean path to ensure consistent format
  const cleanPath = path.startsWith("/") ? path.substring(1) : path;
  
  // Construct and return the CDN URL
  return `${SUPABASE_CDN}/prompt-images/${cleanPath}?width=${width}&quality=${quality}`;
}

// Validate if a URL is reachable
export async function isImageUrlValid(url: string | null): Promise<boolean> {
  if (!url) return false;
  
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.error("Error checking image URL:", error);
    return false;
  }
}
