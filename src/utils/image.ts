
import { supabase } from "@/integrations/supabase/client";

// The correct Supabase URL for this project
const SUPABASE_URL = "https://fxkqgjakbyrxkmevkglv.supabase.co";
const BUCKET = 'prompt-images';
const DEFAULT_BUCKET = 'default-prompt-images';
const DEFAULT_TEXT_PROMPT_IMAGE = 'textpromptdefaultimg.jpg';

export async function getPromptImage(pathOrUrl: string | null | undefined, w = 400, q = 80): Promise<string> {
  if (!pathOrUrl) return '/placeholder.svg';
  if (pathOrUrl.startsWith('http')) return pathOrUrl;
  
  // Clean the path to ensure no double encoding happens
  const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl.substring(1) : pathOrUrl;
  
  // Log path for debugging
  console.log(`Getting image for path: ${cleanPath}`);
  
  try {
    // Get a signed URL for private bucket access
    const bucket = typeof pathOrUrl === 'string' && pathOrUrl === DEFAULT_TEXT_PROMPT_IMAGE ? DEFAULT_BUCKET : BUCKET;
    const { data, error } = await supabase
      .storage
      .from(bucket)
      .createSignedUrl(cleanPath, 300, {
        transform: {
          width: w,
          height: w, // Add height to maintain aspect ratio
          quality: q,
          resize: 'contain' // Use contain to avoid stretching
        }
      });
      
    if (error || !data?.signedUrl) {
      console.error('Error getting signed URL:', error);
      return '/placeholder.svg';
    }
    
    return data.signedUrl;
  } catch (err) {
    console.error('Error in getPromptImage:', err);
    return '/placeholder.svg';
  }
}

export const getCdnUrl = getPromptImage;

export async function uploadDefaultPromptImage(file: File): Promise<string> {
  console.log(`Uploading to DEFAULT_BUCKET: ${DEFAULT_BUCKET}`);
  const path = DEFAULT_TEXT_PROMPT_IMAGE;
  
  // Explicitly use the DEFAULT_BUCKET for default prompt images
  const { data, error } = await supabase.storage
    .from(DEFAULT_BUCKET)
    .upload(path, file, { upsert: true });
    
  if (error) {
    console.error('Error uploading default image:', error);
    throw error;
  }
  
  console.log(`Successfully uploaded to ${DEFAULT_BUCKET}:`, path);
  return path;
}

export async function getTextPromptDefaultImage(): Promise<string> {
  return getPromptImage(DEFAULT_TEXT_PROMPT_IMAGE);
}
