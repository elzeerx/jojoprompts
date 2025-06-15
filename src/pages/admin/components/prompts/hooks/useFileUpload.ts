
import { supabase } from "@/integrations/supabase/client";
import { IMAGE_BUCKET, VIDEO_BUCKET, AUDIO_BUCKET, FILE_BUCKET } from "@/utils/buckets";

export async function uploadFiles(files: File[], bucket?: string): Promise<string[]> {
  const uploadedPaths: string[] = [];
  
  for (const file of files) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    let targetBucket = bucket;
    if (!targetBucket) {
      if (file.type.startsWith('video/')) targetBucket = VIDEO_BUCKET;
      else if (file.type.startsWith('audio/')) targetBucket = AUDIO_BUCKET;
      else targetBucket = IMAGE_BUCKET;
    }
    const { error: uploadError } = await supabase.storage
      .from(targetBucket)
      .upload(fileName, file);
    if (uploadError) throw uploadError;
    uploadedPaths.push(fileName);
  }
  return uploadedPaths;
}
