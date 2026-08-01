import { useQuery } from "@tanstack/react-query";
import { safeHeroImageUrl } from "@/config/v2Flags";
import { getPromptImage } from "@/utils/image";

const SIGNED_URL_TTL_MS = 5 * 60 * 1_000;

/**
 * Resolve either an absolute hero URL or a private Supabase Storage path.
 * Signed URLs remain short lived and are refreshed before their five-minute
 * expiry; the underlying buckets stay private.
 */
export function useHeroImageUrl(
  pathOrUrl: string | null | undefined,
  width = 640,
  quality = 82,
) {
  const absoluteUrl = safeHeroImageUrl(pathOrUrl);
  const storagePath = absoluteUrl ? null : pathOrUrl?.trim() || null;

  const query = useQuery({
    queryKey: ["v2", "hero-image", storagePath, width, quality],
    queryFn: () => getPromptImage(storagePath, width, quality),
    enabled: !!storagePath,
    staleTime: SIGNED_URL_TTL_MS - 60_000,
    gcTime: SIGNED_URL_TTL_MS,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const signedUrl = query.data === "/placeholder.svg" ? null : query.data;

  return {
    url: absoluteUrl ?? signedUrl ?? null,
    isLoading: !!storagePath && query.isPending,
  };
}
