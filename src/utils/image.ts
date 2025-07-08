
import { supabase } from "@/integrations/supabase/client";
import { IMAGE_BUCKET, VIDEO_BUCKET, AUDIO_BUCKET, DEFAULT_IMAGE_BUCKET } from "@/utils/buckets";

// The correct Supabase URL for this project
const SUPABASE_URL = "https://fxkqgjakbyrxkmevkglv.supabase.co";
const BUCKET = IMAGE_BUCKET;
const DEFAULT_BUCKET = DEFAULT_IMAGE_BUCKET;
const DEFAULT_TEXT_PROMPT_IMAGE = 'textpromptdefaultimg.jpg';

export async function getPromptImage(pathOrUrl: string | null | undefined, w = 400, q = 80): Promise<string> {
  if (!pathOrUrl) {
    console.log('No image path provided, returning placeholder');
    return '/placeholder.svg';
  }
  
  if (pathOrUrl.startsWith('http')) {
    console.log(`Using external URL: ${pathOrUrl}`);
    return pathOrUrl;
  }
  
  // Clean the path to ensure no double encoding happens
  const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl.substring(1) : pathOrUrl;
  
  // Log path for debugging
  console.log(`Getting image for path: ${cleanPath}`);
  
  try {
    // Get a signed URL for private bucket access
    const bucket = typeof pathOrUrl === 'string' && pathOrUrl === DEFAULT_TEXT_PROMPT_IMAGE ? DEFAULT_BUCKET : BUCKET;
    
    console.log(`Using bucket: ${bucket} for path: ${cleanPath}`);
    
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
      console.error(`Error getting signed URL for ${cleanPath} in bucket ${bucket}:`, error);
      console.log('Falling back to placeholder image');
      return '/placeholder.svg';
    }
    
    console.log(`Successfully got signed URL for ${cleanPath}: ${data.signedUrl}`);
    return data.signedUrl;
  } catch (err) {
    console.error('Error in getPromptImage:', err);
    console.log('Falling back to placeholder image');
    return '/placeholder.svg';
  }
}

// New function to get a direct media URL without image transformations
export async function getMediaUrl(pathOrUrl: string | null | undefined, mediaType: 'image' | 'video' | 'audio'): Promise<string> {
  if (!pathOrUrl) {
    console.log('No media path provided, returning placeholder');
    return '/placeholder.svg';
  }
  
  if (pathOrUrl.startsWith('http')) {
    console.log(`Using external media URL: ${pathOrUrl}`);
    return pathOrUrl;
  }
  
  // Clean the path to ensure no double encoding happens
  const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl.substring(1) : pathOrUrl;
  
  // Log path for debugging
  console.log(`Getting ${mediaType} URL for path: ${cleanPath}`);
  
  try {
    // Choose the correct bucket based on the media type
    let bucket = IMAGE_BUCKET;
    if (mediaType === 'video') bucket = VIDEO_BUCKET;
    if (mediaType === 'audio') bucket = AUDIO_BUCKET;

    console.log(`Using bucket: ${bucket} for ${mediaType} path: ${cleanPath}`);

    // For images, we use the transformation API. For videos and audio, we get a direct URL
    if (mediaType === 'image') {
      return getPromptImage(pathOrUrl);
    } else {
      // For video and audio, get a direct signed URL without transformations
      const { data, error } = await supabase
        .storage
        .from(bucket)
        .createSignedUrl(cleanPath, 600); // 10 minutes expiry
      
      if (error || !data?.signedUrl) {
        console.error(`Error getting signed URL for ${mediaType} ${cleanPath}:`, error);
        console.log('Falling back to placeholder');
        return '/placeholder.svg';
      }
      
      console.log(`Successfully got ${mediaType} signed URL for ${cleanPath}: ${data.signedUrl}`);
      return data.signedUrl;
    }
  } catch (err) {
    console.error(`Error in getMediaUrl for ${mediaType}:`, err);
    console.log('Falling back to placeholder');
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
  console.log('Getting default text prompt image');
  const result = await getPromptImage(DEFAULT_TEXT_PROMPT_IMAGE);
  console.log(`Default text prompt image URL: ${result}`);
  return result;
}
