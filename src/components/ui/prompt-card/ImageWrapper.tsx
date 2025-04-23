
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Skeleton } from "@/components/ui/skeleton";
import { ImgHTMLAttributes, useState, useEffect } from "react";

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

  // Reset state when src changes
  useEffect(() => {
    if (src) {
      setLoading(true);
      setError(false);
      setImageSrc(src);
    } else {
      setImageSrc(null);
    }
  }, [src]);

  if (!imageSrc) {
    // SVG placeholder for empty image
    return (
      <AspectRatio ratio={aspect} className="bg-muted flex items-center justify-center rounded-lg">
        <span role="img" aria-label="Prompt art" className="text-5xl">🎨</span>
      </AspectRatio>
    );
  }

  const handleError = () => {
    console.log(`Image failed to load: ${imageSrc}`);
    setError(true);
    setLoading(false);
  };

  const handleLoad = () => {
    setLoading(false);
    setError(false);
  };

  return (
    <AspectRatio ratio={aspect} className={`rounded-lg overflow-hidden bg-muted ${className}`}>
      <>
        {loading && (
          <Skeleton className="absolute z-10 inset-0 rounded-lg animate-pulse" />
        )}
        {error ? (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <span role="img" aria-label="Image failed to load" className="text-3xl">📷</span>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <img
              src={imageSrc}
              alt={alt}
              loading="lazy"
              aria-busy={loading}
              onLoad={handleLoad}
              onError={handleError}
              className={`w-full h-full transition duration-300 ${loading ? "opacity-0" : "opacity-100"}`}
              style={{ objectFit: "cover" }}
              {...props}
            />
          </div>
        )}
      </>
    </AspectRatio>
  );
}
