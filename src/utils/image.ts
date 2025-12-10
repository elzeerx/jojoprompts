import { supabase } from "@/integrations/supabase/client";
import { IMAGE_BUCKET, VIDEO_BUCKET, AUDIO_BUCKET, DEFAULT_IMAGE_BUCKET } from "@/utils/buckets";
import { createLogger } from './logging';

const logger = createLogger('IMAGE_SERVICE');

// The correct Supabase URL for this project
const SUPABASE_URL = "https://fxkqgjakbyrxkmevkglv.supabase.co";
const BUCKET = IMAGE_BUCKET;
const DEFAULT_BUCKET = DEFAULT_IMAGE_BUCKET;
const DEFAULT_TEXT_PROMPT_IMAGE = 'textpromptdefaultimg.jpg';

export async function getPromptImage(pathOrUrl: string | null | undefined, w = 400, q = 80): Promise<string> {
  if (!pathOrUrl) {
    logger.debug('No image path provided, returning placeholder');
    return '/placeholder.svg';
  }
  
  if (pathOrUrl.startsWith('http')) {
    logger.debug('Using external URL', { url: pathOrUrl });
    return pathOrUrl;
  }
  
  // Clean the path to ensure no double encoding happens
  const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl.substring(1) : pathOrUrl;
  
  logger.debug('Getting image for path', { cleanPath, width: w, quality: q });
  
  try {
    // Get a signed URL for private bucket access
    const bucket = typeof pathOrUrl === 'string' && pathOrUrl === DEFAULT_TEXT_PROMPT_IMAGE ? DEFAULT_BUCKET : BUCKET;
    
    logger.debug('Using bucket for image', { bucket, cleanPath });
    
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
      logger.error('Error getting signed URL', { error, cleanPath, bucket });
      return '/placeholder.svg';
    }
    
    logger.debug('Successfully got signed URL', { cleanPath, signedUrl: data.signedUrl });
    return data.signedUrl;
  } catch (err) {
    logger.error('Error in getPromptImage', { error: err, cleanPath });
    return '/placeholder.svg';
  }
}

// New function to get a direct media URL without image transformations
export async function getMediaUrl(pathOrUrl: string | null | undefined, mediaType: 'image' | 'video' | 'audio'): Promise<string> {
  if (!pathOrUrl) {
    logger.debug('No media path provided, returning placeholder', { mediaType });
    return '/placeholder.svg';
  }
  
  if (pathOrUrl.startsWith('http')) {
    logger.debug('Using external media URL', { url: pathOrUrl, mediaType });
    return pathOrUrl;
  }
  
  // Clean the path to ensure no double encoding happens
  const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl.substring(1) : pathOrUrl;
  
  logger.debug('Getting media URL for path', { cleanPath, mediaType });
  
  try {
    // Choose the correct bucket based on the media type
    let bucket = IMAGE_BUCKET;
    if (mediaType === 'video') bucket = VIDEO_BUCKET;
    if (mediaType === 'audio') bucket = AUDIO_BUCKET;

    logger.debug('Using bucket for media', { bucket, mediaType, cleanPath });

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
        logger.error('Error getting signed URL for media', { error, mediaType, cleanPath });
        return '/placeholder.svg';
      }
      
      logger.debug('Successfully got media signed URL', { mediaType, cleanPath, signedUrl: data.signedUrl });
      return data.signedUrl;
    }
  } catch (err) {
    logger.error('Error in getMediaUrl', { error: err, mediaType, cleanPath });
    return '/placeholder.svg';
  }
}

export const getCdnUrl = getPromptImage;

export async function uploadDefaultPromptImage(file: File): Promise<string> {
  logger.info('Uploading to DEFAULT_BUCKET', { bucket: DEFAULT_BUCKET });
  const path = DEFAULT_TEXT_PROMPT_IMAGE;
  
  // Explicitly use the DEFAULT_BUCKET for default prompt images
  const { data, error } = await supabase.storage
    .from(DEFAULT_BUCKET)
    .upload(path, file, { upsert: true });
    
  if (error) {
    logger.error('Error uploading default image', { error, bucket: DEFAULT_BUCKET });
    throw error;
  }
  
  logger.info('Successfully uploaded to DEFAULT_BUCKET', { bucket: DEFAULT_BUCKET, path });
  return path;
}

export async function getTextPromptDefaultImage(): Promise<string> {
  logger.debug('Getting default text prompt image');
  const result = await getPromptImage(DEFAULT_TEXT_PROMPT_IMAGE);
  logger.debug('Default text prompt image URL', { result });
  return result;
}
