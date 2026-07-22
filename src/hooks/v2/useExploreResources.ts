import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { V2ResourceType, V2Platform } from "@/config/v2Flags";

export interface ExploreFilters {
  type?: V2ResourceType | "all";
  platforms?: V2Platform[];
  priceMode?: "all" | "free" | "paid";
  search?: string;
  sortBy?: "newest" | "updated" | "price_asc" | "price_desc";
}

export interface ExploreResource {
  id: string;
  slug: string;
  type: V2ResourceType;
  title_en: string;
  title_ar: string | null;
  summary_en: string | null;
  summary_ar: string | null;
  hero_image_url: string | null;
  published_at: string | null;
  updated_at: string;
  current_version: {
    id: string;
    version: string;
    major_version: number;
    updated_at: string;
  } | null;
  platforms: string[];
  product: {
    product_type: string;
    price_fils: number;
    is_active: boolean;
  } | null;
  trust: { scan_status: string | null; scanned_at: string | null } | null;
  owned: boolean;
}

export function useExploreResources(
  filters: ExploreFilters,
  ownedIds: Set<string>,
  libraryOwned: boolean,
) {
  return useQuery({
    queryKey: ["v2", "explore", filters, Array.from(ownedIds).sort(), libraryOwned],
    staleTime: 60_000,
    queryFn: async (): Promise<ExploreResource[]> => {
      let q = supabase
        .from("resources")
        .select(
          "id, slug, type, title_en, title_ar, summary_en, summary_ar, hero_image_url, published_at, updated_at, current_version_id",
        )
        .eq("lifecycle", "published");

      if (filters.type && filters.type !== "all") q = q.eq("type", filters.type);
      if (filters.search && filters.search.trim().length > 0) {
        const term = filters.search.trim().replace(/[%_]/g, "");
        q = q.or(
          `title_en.ilike.%${term}%,title_ar.ilike.%${term}%,summary_en.ilike.%${term}%`,
        );
      }
      q = q.order(
        filters.sortBy === "updated" ? "updated_at" : "published_at",
        { ascending: false, nullsFirst: false },
      );
      q = q.limit(60);
      const { data: rows, error } = await q;
      if (error) throw error;
      const resources = (rows ?? []) as any[];
      if (resources.length === 0) return [];

      const resourceIds = resources.map((r) => r.id);
      const versionIds = resources.map((r) => r.current_version_id).filter(Boolean);

      const [{ data: versions }, { data: plats }, { data: products }, badgeRes] =
        await Promise.all([
          versionIds.length
            ? supabase
                .from("resource_versions")
                .select("id, resource_id, version, major_version, updated_at")
                .in("id", versionIds)
            : Promise.resolve({ data: [] }),
          supabase
            .from("platform_compatibility")
            .select("resource_id, platform_slug")
            .in("resource_id", resourceIds),
          supabase
            .from("products")
            .select("resource_id, product_type, price_fils, is_active")
            .in("resource_id", resourceIds)
            .eq("is_active", true),
          supabase.rpc("get_public_resource_trust_badges", {
            resource_ids: resourceIds,
          }),
        ]);

      const vMap = new Map<string, any>();
      (versions ?? []).forEach((v: any) => vMap.set(v.id, v));
      const pMap = new Map<string, string[]>();
      (plats ?? []).forEach((p: any) => {
        const list = pMap.get(p.resource_id) ?? [];
        list.push(p.platform_slug);
        pMap.set(p.resource_id, list);
      });
      const prodMap = new Map<string, any>();
      (products ?? []).forEach((p: any) => {
        // Prefer 'free' > individual over bundle presence at row level
        const existing = prodMap.get(p.resource_id);
        if (!existing || p.product_type === "free") {
          prodMap.set(p.resource_id, p);
        }
      });
      const tMap = new Map<string, any>();
      const badges = (badgeRes.data ?? []) as any[];
      badges.forEach((b) => tMap.set(b.resource_id, b));

      let list: ExploreResource[] = resources.map((r: any) => {
        const version = r.current_version_id ? vMap.get(r.current_version_id) : null;
        const product = prodMap.get(r.id) ?? null;
        return {
          id: r.id,
          slug: r.slug,
          type: r.type,
          title_en: r.title_en,
          title_ar: r.title_ar,
          summary_en: r.summary_en,
          summary_ar: r.summary_ar,
          hero_image_url: r.hero_image_url,
          published_at: r.published_at,
          updated_at: r.updated_at,
          current_version: version
            ? {
                id: version.id,
                version: version.version,
                major_version: version.major_version,
                updated_at: version.updated_at,
              }
            : null,
          platforms: pMap.get(r.id) ?? [],
          product,
          trust: tMap.get(r.id)
            ? {
                scan_status: tMap.get(r.id).scan_status,
                scanned_at: tMap.get(r.id).scanned_at,
              }
            : null,
          owned: libraryOwned || ownedIds.has(r.id),
        };
      });

      // Filters that require joined data
      if (filters.platforms && filters.platforms.length > 0) {
        list = list.filter((r) =>
          filters.platforms!.some((p) => r.platforms.includes(p)),
        );
      }
      if (filters.priceMode === "free") {
        list = list.filter((r) => r.product?.product_type === "free");
      } else if (filters.priceMode === "paid") {
        list = list.filter(
          (r) => r.product && r.product.product_type !== "free",
        );
      }
      if (filters.sortBy === "price_asc") {
        list.sort(
          (a, b) => (a.product?.price_fils ?? 0) - (b.product?.price_fils ?? 0),
        );
      } else if (filters.sortBy === "price_desc") {
        list.sort(
          (a, b) => (b.product?.price_fils ?? 0) - (a.product?.price_fils ?? 0),
        );
      }
      return list;
    },
  });
}
