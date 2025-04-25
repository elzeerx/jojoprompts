
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Skeleton } from "@/components/ui/skeleton";
import { ImgHTMLAttributes, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle } from "lucide-react";
import { getResponsiveImageSources } from "@/utils/image";

export function ImageWrapper({
  src,
  alt,
  aspect = 4 / 3,
  className = "",
  priority = false,
  onLoad,
  onError,
  ...props
}: {
  src?: string | null;
  alt?: string;
  aspect?: number;
  className?: string;
  priority?: boolean;
  onLoad?: () => void;
  onError?: () => void;
} & Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "onLoad" | "onError">) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(src);
  const [retries, setRetries] = useState(0);
  const MAX_RETRIES = 2;

  // For responsive images
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  
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
  
  // Update viewport width for responsive images
  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // For edge function access logging
  useEffect(() => {
    if (imageSrc && imageSrc.includes('/api/get-image/') && retries === 0) {
      const startTime = performance.now();
      
      // Add a timestamp to mark the load beginning
      console.log(`Starting image load via edge function: ${imageSrc}`);
      
      // After the image loads, log the time it took
      const imageLoadComplete = () => {
        const loadTime = performance.now() - startTime;
        console.log(`Image loaded in ${loadTime.toFixed(2)}ms: ${imageSrc}`);
      };
      
      // Set up a one-time event listener
      const img = new Image();
      img.onload = imageLoadComplete;
      img.src = imageSrc;
    }
  }, [imageSrc, retries]);

  // Fallback to direct authenticated fetch if edge function fails
  useEffect(() => {
    const fetchPrivateImage = async () => {
      // Only try direct fetch if we had an error with the edge function
      if (error && retries === 1 && imageSrc && imageSrc.includes('/api/get-image/')) {
        try {
          // Extract the path from the URL more reliably
          const pathStart = imageSrc.indexOf('/api/get-image/') + '/api/get-image/'.length;
          const pathEnd = imageSrc.indexOf('?', pathStart);
          const encodedPath = pathEnd > 0 
            ? imageSrc.substring(pathStart, pathEnd) 
            : imageSrc.substring(pathStart);
          
          const path = decodeURIComponent(encodedPath);
          
          console.log(`Trying direct authenticated fetch for: ${path}`);
          
          // Get signed URL for the image from private bucket
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
          setRetries(MAX_RETRIES); // Move to final error state
        }
      }
    };
    
    fetchPrivateImage();
  }, [error, retries, imageSrc]);

  // Generate responsive sources based on the original src
  const responsiveSources = src ? getResponsiveImageSources(src) : null;
  
  // Choose appropriate image size based on viewport
  const getResponsiveImageSrc = () => {
    if (!responsiveSources) return imageSrc;
    
    if (viewportWidth <= 640) {
      return responsiveSources.small;
    } else if (viewportWidth <= 1024) {
      return responsiveSources.medium;
    } else {
      return responsiveSources.large;
    }
  };
  
  const responsiveImageSrc = getResponsiveImageSrc() || imageSrc;

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
    
    // Call the external error handler if provided
    onError?.();
    
    // Try fallback method if we haven't already reached max retries
    if (retries < MAX_RETRIES) {
      setRetries(prev => prev + 1);
    }
  };

  const handleLoad = () => {
    console.log(`Image loaded successfully: ${imageSrc}`);
    setLoading(false);
    setError(false);
    
    // Call the external load handler if provided
    onLoad?.();
  };

  const handleRetry = () => {
    if (src) {
      setLoading(true);
      setError(false);
      // Add a timestamp to bust cache
      const timestamp = Date.now();
      if (src.includes('?')) {
        setImageSrc(`${src}&t=${timestamp}`);
      } else {
        setImageSrc(`${src}?t=${timestamp}`);
      }
      setRetries(0);
    }
  };

  return (
    <AspectRatio ratio={aspect} className={`rounded-lg overflow-hidden bg-muted ${className}`}>
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
            src={responsiveImageSrc}
            srcSet={responsiveSources ? `
              ${responsiveSources.small} 400w,
              ${responsiveSources.medium} 800w,
              ${responsiveSources.large} 1200w
            ` : undefined}
            sizes={responsiveSources ? '(max-width: 640px) 400px, (max-width: 1024px) 800px, 1200px' : undefined}
            alt={alt || "Prompt image"}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            aria-busy={loading}
            decoding="async"
            onLoad={handleLoad}
            onError={handleError}
            className={`w-full h-full object-cover transition duration-300 ${loading ? "opacity-0" : "opacity-100"}`}
            {...props}
          />
        )}
      </div>
    </AspectRatio>
  );
}
