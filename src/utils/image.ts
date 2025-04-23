
// The correct Supabase URL for this project
const SUPABASE_URL = "https://fxkqgjakbyrxkmevkglv.supabase.co";
// For private bucket access, we need to use authenticated endpoints
const BUCKET = 'prompt-images';

export function getPromptImage(pathOrUrl: string | null | undefined, w = 400, q = 80) {
  if (!pathOrUrl) return '/img/placeholder.png';
  if (pathOrUrl.startsWith('http')) return pathOrUrl;
  
  // Make sure we're using the correct endpoint for private images
  // We'll use the get-image edge function instead of a direct storage URL
  return `/api/get-image/${encodeURIComponent(pathOrUrl)}?width=${w}&quality=${q}`;
}

// For backward compatibility (e.g., used by pdf-export)
export const getCdnUrl = getPromptImage;
