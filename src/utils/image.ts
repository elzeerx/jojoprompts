
// The correct Supabase URL for this project
const SUPABASE_URL = "https://fxkqgjakbyrxkmevkglv.supabase.co";
const STORAGE_BASE = `${SUPABASE_URL}/storage/v1/object/public`;
const BUCKET = 'prompt-images';

export function getPromptImage(pathOrUrl: string | null | undefined, w = 400, q = 80) {
  if (!pathOrUrl) return '/img/placeholder.png';
  if (pathOrUrl.startsWith('http')) return pathOrUrl;
  
  // Properly encode the path components
  const encodedPath = encodeURIComponent(pathOrUrl);
  return `${STORAGE_BASE}/${BUCKET}/${encodedPath}?width=${w}&quality=${q}`;
}

// For backward compatibility (e.g., used by pdf-export)
export const getCdnUrl = getPromptImage;
