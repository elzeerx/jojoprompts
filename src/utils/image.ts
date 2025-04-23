
// The correct Supabase URL for this project
const SUPABASE_URL = "https://fxkqgjakbyrxkmevkglv.supabase.co";
// For private bucket access, we need to use authenticated endpoints
const BUCKET = 'prompt-images';

export function getPromptImage(pathOrUrl: string | null | undefined, w = 400, q = 80) {
  if (!pathOrUrl) return '/img/placeholder.png';
  if (pathOrUrl.startsWith('http')) return pathOrUrl;
  
  // Clean the path to ensure no double encoding happens
  const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl.substring(1) : pathOrUrl;
  
  // Log path for debugging
  console.log(`Getting image for path: ${cleanPath}`);
  
  // Make sure we're using the correct endpoint for private images
  return `/api/get-image/${encodeURIComponent(cleanPath)}?width=${w}&quality=${q}`;
}

// For backward compatibility (e.g., used by pdf-export)
export const getCdnUrl = getPromptImage;
