
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Skeleton } from "@/components/ui/skeleton";
import { ImgHTMLAttributes, useState } from "react";

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

  if (!src) {
    // SVG placeholder for empty image (use emoji if you wish!)
    return (
      <AspectRatio ratio={aspect} className="bg-muted flex items-center justify-center rounded-lg">
        <span role="img" aria-label="Prompt art" className="text-5xl">🎨</span>
      </AspectRatio>
    );
  }

  return (
    <AspectRatio ratio={aspect} className={`rounded-lg overflow-hidden bg-muted ${className}`}>
      <>
        {loading && (
          <Skeleton className="absolute z-10 inset-0 rounded-lg animate-pulse" />
        )}
        <div className="w-full h-full flex items-center justify-center">
          <img
            src={src}
            alt={alt}
            loading="lazy"
            aria-busy={loading}
            onLoad={() => setLoading(false)}
            className={`w-full h-full transition duration-300 ${loading ? "opacity-0" : "opacity-100"}`}
            style={{ objectFit: "cover" }}
            {...props}
          />
        </div>
      </>
    </AspectRatio>
  );
}
