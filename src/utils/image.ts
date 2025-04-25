
// The correct Supabase URL for this project
const SUPABASE_URL = "https://fxkqgjakbyrxkmevkglv.supabase.co";
// For private bucket access, we need to use authenticated endpoints
const BUCKET = 'prompt-images';

/**
 * Gets optimized image URL with proper format and size
 * @param pathOrUrl Image path or URL
 * @param w Requested width
 * @param q Quality (1-100)
 * @param format Image format (webp, jpeg, png)
 * @returns Optimized image URL
 */
export function getPromptImage(pathOrUrl: string | null | undefined, w = 400, q = 80, format = 'webp') {
  if (!pathOrUrl) return '/img/placeholder.png';
  if (pathOrUrl.startsWith('http')) return pathOrUrl;
  
  // Clean the path to ensure no double encoding happens
  const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl.substring(1) : pathOrUrl;
  
  // Make sure we're using the correct endpoint for private images - edge function
  // This will handle authentication and permissions
  return `/api/get-image/${encodeURIComponent(cleanPath)}?width=${w}&quality=${q}&format=${format}`;
}

/**
 * Gets different image sizes for responsive loading
 * @param pathOrUrl Image path or URL
 * @returns Object with different sized images
 */
export function getResponsiveImageSources(pathOrUrl: string | null | undefined) {
  if (!pathOrUrl) return {
    small: '/img/placeholder.png',
    medium: '/img/placeholder.png',
    large: '/img/placeholder.png',
    original: '/img/placeholder.png'
  };
  
  return {
    small: getPromptImage(pathOrUrl, 400, 80),
    medium: getPromptImage(pathOrUrl, 800, 80),
    large: getPromptImage(pathOrUrl, 1200, 85),
    original: getPromptImage(pathOrUrl, 2000, 90)
  };
}

// For backward compatibility (e.g., used by pdf-export)
export const getCdnUrl = getPromptImage;
