
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Skeleton } from "@/components/ui/skeleton";
import { ImgHTMLAttributes, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function ImageWrapper({
  src,
  alt,
  aspect = 4 / 3,
  className = "",
  ...props
}: {
  src?: string | null;
  alt?: string;
  aspect?: number;
  className?: string;
} & Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt">) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(src);
  const [retries, setRetries] = useState(0);

  // Reset state when src changes
  useEffect(() => {
    if (src) {
      setLoading(true);
      setError(false);
      setImageSrc(src);
      setRetries(0);
    } else {
      setImageSrc(null);
    }
  }, [src]);

  // For direct bucket access if needed
  useEffect(() => {
    if (imageSrc && imageSrc.includes('/api/images/') && retries === 0) {
      console.debug(`Loading image via edge function: ${imageSrc}`);
    }
  }, [imageSrc, retries]);

  // Fallback to direct authenticated fetch if edge function fails
  useEffect(() => {
    const fetchPrivateImage = async () => {
      // Only try direct fetch if we had an error with the edge function
      if (error && retries === 1 && imageSrc && imageSrc.includes('/api/images/')) {
        try {
          const path = decodeURIComponent(imageSrc.split('/api/images/')[1].split('?')[0]);
          console.debug(`Trying direct fetch for: ${path}`);
          
          // Get signed URL for the image
          const { data, error: fetchError } = await supabase
            .storage
            .from('prompt-images')
            .createSignedUrl(path, 300); // 5 minutes expiry
            
          if (fetchError || !data?.signedUrl) {
            console.error('Error getting signed URL:', fetchError);
            return;
          }
          
          // Try with the signed URL
          setImageSrc(data.signedUrl);
          setError(false);
          setLoading(true);
          setRetries(2); // Mark that we've tried the signed URL approach
        } catch (err) {
          console.error('Error in direct fetch fallback:', err);
        }
      }
    };
    
    fetchPrivateImage();
  }, [error, retries, imageSrc]);

  if (!imageSrc) {
    // SVG placeholder for empty image
    return (
      <AspectRatio ratio={aspect} className="bg-muted flex items-center justify-center rounded-lg">
        <span role="img" aria-label="Prompt art" className="text-5xl">🎨</span>
      </AspectRatio>
    );
  }

  const handleError = () => {
    console.error(`Image failed to load: ${imageSrc}`);
    setError(true);
    setLoading(false);
    
    // Try fallback method if we haven't already
    if (retries < 2) {
      setRetries(prev => prev + 1);
    }
  };

  const handleLoad = () => {
    console.debug(`Image loaded successfully: ${imageSrc}`);
    setLoading(false);
    setError(false);
  };

  return (
    <AspectRatio ratio={aspect} className={`rounded-lg overflow-hidden bg-muted ${className}`}>
      <>
        {loading && (
          <Skeleton className="absolute z-10 inset-0 rounded-lg animate-pulse" />
        )}
        {error && retries >= 2 ? (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <span role="img" aria-label="Image failed to load" className="text-3xl">📷</span>
            <span className="sr-only">Image failed to load</span>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <img
              src={imageSrc}
              alt={alt || "Prompt image"}
              loading="lazy"
              aria-busy={loading}
              onLoad={handleLoad}
              onError={handleError}
              className={`w-full h-full object-cover transition duration-300 ${loading ? "opacity-0" : "opacity-100"}`}
              {...props}
            />
          </div>
        )}
      </>
    </AspectRatio>
  );
}
