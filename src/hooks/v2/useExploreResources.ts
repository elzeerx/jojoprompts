import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  effortBucketFor,
  type EffortBucket,
  type V2Platform,
  type V2ResourceType,
} from "@/config/v2Flags";

export interface ExploreFilters {
  type?: V2ResourceType | "all";
  platforms?: V2Platform[];
  priceMode?: "all" | "free" | "paid";
  effort?: EffortBucket | "all";
  search?: string;
  sortBy?: "newest" | "updated" | "price_asc" | "price_desc";
}

export interface ExploreProduct {
  product_type: "free" | "individual" | "bundle" | "lifetime";
  price_fils: number;
  is_active: boolean;
}

export interface ExploreVersion {
  id: string;
  version: string;
  major_version: number;
  updated_at: string;
}

export interface ExploreTrust {
  scan_status: string | null;
  scanned_at: string | null;
}

export interface ExploreResource {
  id: string;
  slug: string;
  type: V2ResourceType;
  title_en: string;
  title_ar: string | null;
  summary_en: string | null;
  summary_ar: string | null;
  hero_image_path: string | null;
  effort_minutes: number | null;
  published_at: string | null;
  updated_at: string;
  current_version: ExploreVersion | null;
  platforms: string[];
  product: ExploreProduct | null;
  trust: ExploreTrust | null;
  owned: boolean;
  ownedVia: "library" | "resource" | null;
}

interface ResourceRow {
  id: string;
  slug: string;
  type: V2ResourceType;
  title_en: string;
  title_ar: string | null;
  summary_en: string | null;
  summary_ar: string | null;
  hero_image_path: string | null;
  effort_minutes: number | null;
  published_at: string | null;
  updated_at: string;
  current_version_id: string | null;
}

export function useExploreResources(
  filters: ExploreFilters,
  ownedIds: Set<string>,
  libraryOwned: boolean,
) {
  return useQuery({
    queryKey: [
      "v2",
      "explore",
      filters,
      Array.from(ownedIds).sort(),
      libraryOwned,
    ],
    staleTime: 60_000,
    queryFn: async (): Promise<ExploreResource[]> => {
      let q = supabase
        .from("resources")
        .select(
          "id, slug, type, title_en, title_ar, summary_en, summary_ar, hero_image_path, effort_minutes, published_at, updated_at, current_version_id",
        )
        .eq("lifecycle", "published");

      if (filters.type && filters.type !== "all") q = q.eq("type", filters.type);
      if (filters.search && filters.search.trim().length > 0) {
        const term = filters.search.trim().replace(/[%_,()]/g, "");
        if (term.length > 0) {
          q = q.or(
            `title_en.ilike.%${term}%,title_ar.ilike.%${term}%,summary_en.ilike.%${term}%`,
          );
        }
      }
      q = q.order(
        filters.sortBy === "updated" ? "updated_at" : "published_at",
        { ascending: false, nullsFirst: false },
      );
      q = q.limit(60);
      const { data: rows, error } = await q;
      if (error) throw error;
      const resources = (rows ?? []) as ResourceRow[];
      if (resources.length === 0) return [];

      const resourceIds = resources.map((r) => r.id);
      const versionIds = resources
        .map((r) => r.current_version_id)
        .filter((v): v is string => !!v);

      const [versionsRes, platsRes, productsRes, badgeRes] = await Promise.all([
        versionIds.length
          ? supabase
              .from("resource_versions")
              .select("id, resource_id, version, major_version, updated_at")
              .in("id", versionIds)
          : Promise.resolve({ data: [], error: null }),
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

      // Fail loudly if any batch query errors — never render partial trust/price/version data.
      if (versionsRes.error) throw versionsRes.error;
      if (platsRes.error) throw platsRes.error;
      if (productsRes.error) throw productsRes.error;
      if (badgeRes.error) throw badgeRes.error;

      const vMap = new Map<string, ExploreVersion>();
      (versionsRes.data ?? []).forEach((v) =>
        vMap.set(v.id, {
          id: v.id,
          version: v.version,
          major_version: v.major_version,
          updated_at: v.updated_at,
        }),
      );

      const pMap = new Map<string, string[]>();
      (platsRes.data ?? []).forEach((p) => {
        const list = pMap.get(p.resource_id) ?? [];
        list.push(p.platform_slug);
        pMap.set(p.resource_id, list);
      });

      const prodMap = new Map<string, ExploreProduct>();
      (productsRes.data ?? []).forEach((p) => {
        const row: ExploreProduct = {
          product_type: p.product_type as ExploreProduct["product_type"],
          price_fils: p.price_fils ?? 0,
          is_active: !!p.is_active,
        };
        const existing = prodMap.get(p.resource_id);
        // Prefer free listing when both exist for the same resource.
        if (!existing || row.product_type === "free") prodMap.set(p.resource_id, row);
      });

      const tMap = new Map<string, ExploreTrust>();
      ((badgeRes.data ?? []) as Array<{ resource_id: string; scan_status: string | null; scanned_at: string | null }>).forEach(
        (b) => tMap.set(b.resource_id, { scan_status: b.scan_status, scanned_at: b.scanned_at }),
      );

      let list: ExploreResource[] = resources.map((r) => {
        const ownedIndividually = ownedIds.has(r.id);
        return {
          id: r.id,
          slug: r.slug,
          type: r.type,
          title_en: r.title_en,
          title_ar: r.title_ar,
          summary_en: r.summary_en,
          summary_ar: r.summary_ar,
          hero_image_path: r.hero_image_path,
          effort_minutes: r.effort_minutes,
          published_at: r.published_at,
          updated_at: r.updated_at,
          current_version: r.current_version_id ? vMap.get(r.current_version_id) ?? null : null,
          platforms: pMap.get(r.id) ?? [],
          product: prodMap.get(r.id) ?? null,
          trust: tMap.get(r.id) ?? null,
          owned: libraryOwned || ownedIndividually,
          ownedVia: libraryOwned ? "library" : ownedIndividually ? "resource" : null,
        };
      });

      if (filters.platforms && filters.platforms.length > 0) {
        list = list.filter((r) =>
          filters.platforms!.some((p) => r.platforms.includes(p)),
        );
      }
      if (filters.priceMode === "free") {
        list = list.filter((r) => r.product?.product_type === "free");
      } else if (filters.priceMode === "paid") {
        list = list.filter((r) => r.product && r.product.product_type !== "free");
      }
      if (filters.effort && filters.effort !== "all") {
        list = list.filter((r) => effortBucketFor(r.effort_minutes) === filters.effort);
      }
      if (filters.sortBy === "price_asc") {
        list.sort((a, b) => (a.product?.price_fils ?? 0) - (b.product?.price_fils ?? 0));
      } else if (filters.sortBy === "price_desc") {
        list.sort((a, b) => (b.product?.price_fils ?? 0) - (a.product?.price_fils ?? 0));
      }
      return list;
    },
  });
}
