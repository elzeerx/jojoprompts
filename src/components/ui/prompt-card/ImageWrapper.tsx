import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Skeleton } from "@/components/ui/skeleton";
import { ImgHTMLAttributes, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle } from "lucide-react";

export function ImageWrapper({
  src,
  alt,
  aspect,
  className = "",
  onLoad,
  onError,
  disableAspectRatio = false,
  isCard = true,
  ...props
}: {
  src?: string | null;
  alt?: string;
  aspect?: number;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
  disableAspectRatio?: boolean;
  isCard?: boolean;
} & Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "onLoad" | "onError">) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(src);
  const [retries, setRetries] = useState(0);
  const MAX_RETRIES = 2;

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

  useEffect(() => {
    if (imageSrc && typeof imageSrc === 'string' && imageSrc.includes('/api/get-image/') && retries === 0) {
      console.log(`Loading image via edge function: ${imageSrc}`);
    }
  }, [imageSrc, retries]);

  useEffect(() => {
    const fetchPrivateImage = async () => {
      if (error && retries === 1 && imageSrc && typeof imageSrc === 'string' && imageSrc.includes('/api/get-image/')) {
        try {
          const pathStart = imageSrc.indexOf('/api/get-image/') + '/api/get-image/'.length;
          const pathEnd = imageSrc.indexOf('?', pathStart);
          const encodedPath = pathEnd > 0 
            ? imageSrc.substring(pathStart, pathEnd) 
            : imageSrc.substring(pathStart);
          
          const path = decodeURIComponent(encodedPath);
          
          console.log(`Trying direct authenticated fetch for: ${path}`);
          
          const { data, error: supabaseError } = await supabase
            .storage
            .from('prompt-images')
            .createSignedUrl(path, 300);
            
          if (supabaseError || !data?.signedUrl) {
            console.error('Error getting signed URL:', supabaseError);
            return;
          }
          
          setImageSrc(data.signedUrl);
          setError(false);
          setLoading(true);
          setRetries(2);
        } catch (err) {
          console.error('Error in direct fetch fallback:', err);
          setRetries(MAX_RETRIES);
        }
      }
    };
    
    fetchPrivateImage();
  }, [error, retries, imageSrc]);

  if (!imageSrc) {
    if (disableAspectRatio) {
      return (
        <div className="flex items-center justify-center bg-muted rounded-lg p-8">
          <span role="img" aria-label="Prompt art" className="text-5xl">🎨</span>
        </div>
      );
    }
    return (
      <AspectRatio ratio={aspect} className="bg-muted flex items-center justify-center rounded-lg">
        <span role="img" aria-label="Prompt art" className="text-5xl">🎨</span>
      </AspectRatio>
    );
  }

  const ImageContainer = disableAspectRatio ? 'div' : AspectRatio;
  const containerProps = disableAspectRatio ? {} : { ratio: aspect };

  const handleError = () => {
    console.error(`Image failed to load: ${imageSrc}`);
    setError(true);
    setLoading(false);
    
    onError?.();
    
    if (retries < MAX_RETRIES) {
      setRetries(prev => prev + 1);
    }
  };

  const handleLoad = () => {
    console.log(`Image loaded successfully: ${imageSrc}`);
    setLoading(false);
    setError(false);
    
    onLoad?.();
  };

  const handleRetry = () => {
    if (src) {
      setLoading(true);
      setError(false);
      const timestamp = Date.now();
      if (typeof src === 'string') {
        if (src.includes('?')) {
          setImageSrc(`${src}&t=${timestamp}`);
        } else {
          setImageSrc(`${src}?t=${timestamp}`);
        }
      } else {
        setImageSrc('/img/placeholder.png');
      }
      setRetries(0);
    }
  };

  return (
    <ImageContainer {...containerProps} className={`rounded-lg overflow-hidden bg-muted ${className}`}>
      <div className="w-full h-full flex items-center justify-center">
        {loading && (
          <Skeleton className="absolute inset-0 z-10 rounded-lg animate-pulse" />
        )}
        {error && retries >= MAX_RETRIES ? (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground flex-col gap-2">
            <AlertCircle className="h-6 w-6 mb-1" />
            <span role="img" aria-label="Image failed to load" className="text-sm">Image failed to load</span>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleRetry();
              }}
              className="mt-2 px-3 py-1 text-xs bg-primary/10 hover:bg-primary/20 text-primary rounded-md transition-colors"
            >
              Try again
            </button>
            <span className="sr-only">Image failed to load</span>
          </div>
        ) : (
          <img
            src={imageSrc || '/img/placeholder.png'}
            alt={alt || "Prompt image"}
            loading="lazy"
            aria-busy={loading}
            onLoad={handleLoad}
            onError={handleError}
            className={`w-full h-full transition duration-300 ${loading ? "opacity-0" : "opacity-100"} ${
              isCard ? "object-cover" : "object-contain max-h-[70vh]"
            }`}
            {...props}
          />
        )}
      </div>
    </ImageContainer>
  );
}
