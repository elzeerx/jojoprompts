
import { supabase } from "@/integrations/supabase/client";

// The correct Supabase URL for this project
const SUPABASE_URL = "https://fxkqgjakbyrxkmevkglv.supabase.co";
const BUCKET = 'prompt-images';
const DEFAULT_BUCKET = 'default-prompt-images';

export async function getPromptImage(pathOrUrl: string | null | undefined, w = 400, q = 80) {
  if (!pathOrUrl) return '/img/placeholder.png';
  if (pathOrUrl.startsWith('http')) return pathOrUrl;
  
  // Clean the path to ensure no double encoding happens
  const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl.substring(1) : pathOrUrl;
  
  // Log path for debugging
  console.log(`Getting image for path: ${cleanPath}`);
  
  // Get a signed URL for private bucket access
  const bucket = pathOrUrl.includes('text-prompt-default') ? DEFAULT_BUCKET : BUCKET;
  const { data, error } = await supabase
    .storage
    .from(bucket)
    .createSignedUrl(cleanPath, 300, {
      transform: {
        width: w,
        quality: q
      }
    });
    
  if (error || !data?.signedUrl) {
    console.error('Error getting signed URL:', error);
    return '/img/placeholder.png';
  }
  
  return data.signedUrl;
}

export const getCdnUrl = getPromptImage;

export async function uploadDefaultPromptImage(file: File) {
  const path = `text-prompt-default.${file.name.split('.').pop()}`;
  const { error } = await supabase.storage
    .from(DEFAULT_BUCKET)
    .upload(path, file, { upsert: true });
    
  if (error) {
    console.error('Error uploading default image:', error);
    throw error;
  }
  
  return path;
}

export async function getTextPromptDefaultImage() {
  return getPromptImage('text-prompt-default.png');
}
