
import { supabase } from "@/integrations/supabase/client";

// Unified image URL helper for prompt cards and dialogs
export const getPromptImage = (
  p: { image_path?: string | null; image_url?: string | null },
  width = 400,
  quality = 80
) => {
  if (p.image_path)
    return `${supabase.storageUrl}/render/image/${encodeURIComponent(
      p.image_path!
    )}?width=${width}&quality=${quality}`;
  if (p.image_url) return p.image_url;
  return "/img/placeholder.svg";
};
