/**
 * Server-paged Explore hook — pushes deterministic pagination onto the
 * `resources` base query via `.range()` + `{ count: "exact" }` so the
 * Explore surface can reach every published row without fetching the
 * whole catalog at once.
 *
 * Server-side filters (applied before paging, so pages never overlap or
 * lose rows within the base filter universe):
 *   - lifecycle = 'published'
 *   - type
 *   - text search (title_en / title_ar / summary_en, ilike)
 *   - effort bucket (translated to effort_minutes ranges)
 *   - sort by newest / recently updated
 *
 * Client-side, per-page post-filters (documented limitation): `platforms`
 * and `priceMode`. These require joined lookups (`platform_compatibility`,
 * `products`) that PostgREST cannot filter cleanly in the same select
 * without an inner join we do not model here. They still act on every
 * loaded page, and Load-more keeps expanding the loaded set until the
 * server reports the end of the base-filter universe.
 */
import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  effortBucketFor,
  type EffortBucket,
  type V2Platform,
  type V2ResourceType,
} from "@/config/v2Flags";
import type {
  ExploreFilters,
  ExploreProduct,
  ExploreResource,
  ExploreTrust,
  ExploreVersion,
} from "@/hooks/v2/useExploreResources";

export const EXPLORE_PAGE_SIZE = 30;

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

interface ExplorePage {
  rows: ExploreResource[];
  /** Total rows matching the base server-side filter universe. */
  baseTotal: number;
  pageIndex: number;
  hasMore: boolean;
}

function effortRange(bucket: EffortBucket | "all" | undefined): [number | null, number | null] | null {
  if (!bucket || bucket === "all") return null;
  if (bucket === "quick") return [0, 15];
  if (bucket === "standard") return [16, 45];
  if (bucket === "advanced") return [46, null];
  return null;
}

const SELECT = (s: string): string => s;

export function useInfiniteExploreResources(
  filters: ExploreFilters,
  ownedIds: Set<string>,
  libraryOwned: boolean,
  pageSize: number = EXPLORE_PAGE_SIZE,
) {
  return useInfiniteQuery({
    queryKey: [
      "v2",
      "explore-infinite",
      filters,
      Array.from(ownedIds).sort(),
      libraryOwned,
      pageSize,
    ],
    initialPageParam: 0,
    staleTime: 60_000,
    getNextPageParam: (last: ExplorePage) =>
      last.hasMore ? last.pageIndex + 1 : undefined,
    queryFn: async ({ pageParam }): Promise<ExplorePage> => {
      const pageIndex = typeof pageParam === "number" ? pageParam : 0;
      const from = pageIndex * pageSize;
      const to = from + pageSize - 1;

      let q = supabase
        .from("resources")
        .select(
          SELECT(
            "id, slug, type, title_en, title_ar, summary_en, summary_ar, hero_image_path, effort_minutes, published_at, updated_at, current_version_id",
          ),
          { count: "exact" },
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

      const range = effortRange(filters.effort);
      if (range) {
        const [lo, hi] = range;
        if (lo !== null) q = q.gte("effort_minutes", lo);
        if (hi !== null) q = q.lte("effort_minutes", hi);
      }

      const sortCol =
        filters.sortBy === "updated" ? "updated_at" : "published_at";
      q = q.order(sortCol, { ascending: false, nullsFirst: false });
      // Deterministic tiebreaker so pages never overlap when timestamps collide.
      q = q.order("id", { ascending: true });
      q = q.range(from, to);

      const { data, error, count } = await q.returns<ResourceRow[]>();
      if (error) throw error;
      const resources: ResourceRow[] = data ?? [];

      let hydrated: ExploreResource[] = [];
      if (resources.length > 0) {
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
            .select("id, resource_id, product_type, price_fils, is_active")
            .in("resource_id", resourceIds)
            .eq("is_active", true),
          supabase.rpc("get_public_resource_trust_badges", {
            resource_ids: resourceIds,
          }),
        ]);
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
            id: p.id,
            product_type: p.product_type as ExploreProduct["product_type"],
            price_fils: p.price_fils ?? 0,
            is_active: !!p.is_active,
          };
          const existing = prodMap.get(p.resource_id);
          if (!existing || row.product_type === "free") prodMap.set(p.resource_id, row);
        });
        const tMap = new Map<string, ExploreTrust>();
        ((badgeRes.data ?? []) as Array<{
          resource_id: string;
          scan_status: string | null;
          scanned_at: string | null;
        }>).forEach((b) =>
          tMap.set(b.resource_id, {
            scan_status: b.scan_status,
            scanned_at: b.scanned_at,
          }),
        );

        hydrated = resources.map((r) => {
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
            current_version: r.current_version_id
              ? vMap.get(r.current_version_id) ?? null
              : null,
            platforms: pMap.get(r.id) ?? [],
            product: prodMap.get(r.id) ?? null,
            trust: tMap.get(r.id) ?? null,
            owned: libraryOwned || ownedIndividually,
            ownedVia: libraryOwned
              ? "library"
              : ownedIndividually
                ? "resource"
                : null,
          };
        });

        // Client-side post filters (limited to loaded pages).
        if (filters.platforms && filters.platforms.length > 0) {
          hydrated = hydrated.filter((r) =>
            filters.platforms!.some((p) => r.platforms.includes(p)),
          );
        }
        if (filters.priceMode === "free") {
          hydrated = hydrated.filter((r) => r.product?.product_type === "free");
        } else if (filters.priceMode === "paid") {
          hydrated = hydrated.filter(
            (r) => r.product && r.product.product_type !== "free",
          );
        }
        // Note: effort is already server-side; effortBucketFor kept for card display parity.
        void effortBucketFor(0);
      }

      // Client-side sort for price columns (product data lives in a side query).
      if (filters.sortBy === "price_asc") {
        hydrated.sort(
          (a, b) => (a.product?.price_fils ?? 0) - (b.product?.price_fils ?? 0),
        );
      } else if (filters.sortBy === "price_desc") {
        hydrated.sort(
          (a, b) => (b.product?.price_fils ?? 0) - (a.product?.price_fils ?? 0),
        );
      }

      const baseTotal = typeof count === "number" ? count : from + resources.length;
      const hasMore = from + resources.length < baseTotal;

      return { rows: hydrated, baseTotal, pageIndex, hasMore };
    },
  });
}
