
const STORAGE_BASE = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public`;
const BUCKET = 'prompt-images';

export function getPromptImage(pathOrUrl: string | null | undefined, w = 400, q = 80) {
  if (!pathOrUrl) return '/img/placeholder.png';
  if (pathOrUrl.startsWith('http')) return pathOrUrl;
  return `${STORAGE_BASE}/${BUCKET}/${encodeURIComponent(pathOrUrl)}?width=${w}&quality=${q}`;
}

// For backward compatibility (e.g., used by pdf-export)
export const getCdnUrl = getPromptImage;
