/**
 * Bounded newest-resources feed for the public homepage. One deterministic
 * server query (published, order by published_at DESC, id ASC, limit N) plus
 * the same trust/version/product/platform hydration used by Explore.
 *
 * Never throws unhandled — main list still renders when a side query fails;
 * only the affected metadata (trust/version/etc) is left as null so cards
 * degrade to a truthful neutral state (see card contract).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  ExploreProduct,
  ExploreResource,
  ExploreTrust,
  ExploreVersion,
} from "@/hooks/v2/useExploreResources";
import type { V2ResourceType } from "@/config/v2Flags";

interface Row {
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
  latest_published_version_id: string | null;
}

const SELECT = (s: string): string => s;

export function useLatestPublishedResources(limit: number = 6) {
  return useQuery({
    queryKey: ["v2", "latest-published", limit],
    staleTime: 60_000,
    queryFn: async (): Promise<ExploreResource[]> => {
      const { data, error } = await supabase
        .from("resources")
        .select(
          SELECT(
            "id, slug, type, title_en, title_ar, summary_en, summary_ar, hero_image_path, effort_minutes, published_at, updated_at, latest_published_version_id",
          ),
        )
        .eq("lifecycle", "published")
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("id", { ascending: true })
        .limit(limit)
        .returns<Row[]>();

      if (error) throw error;
      const rows: Row[] = data ?? [];
      if (rows.length === 0) return [];

      const ids = rows.map((r) => r.id);
      const versionIds = rows
        .map((r) => r.latest_published_version_id)
        .filter((v): v is string => !!v);

      // Best-effort side hydration. If any single side query fails, the main
      // list still renders — cards show truthful neutral fallbacks instead.
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
          .in("resource_id", ids),
        supabase
          .from("products")
          .select("id, resource_id, product_type, price_fils, is_active")
          .in("resource_id", ids)
          .eq("is_active", true),
        supabase.rpc("get_public_resource_trust_badges", { resource_ids: ids }),
      ]);

      const vMap = new Map<string, ExploreVersion>();
      if (!versionsRes.error) {
        (versionsRes.data ?? []).forEach((v) =>
          vMap.set(v.id, {
            id: v.id,
            version: v.version,
            major_version: v.major_version,
            updated_at: v.updated_at,
          }),
        );
      }
      const pMap = new Map<string, string[]>();
      if (!platsRes.error) {
        (platsRes.data ?? []).forEach((p) => {
          const arr = pMap.get(p.resource_id) ?? [];
          arr.push(p.platform_slug);
          pMap.set(p.resource_id, arr);
        });
      }
      const prodMap = new Map<string, ExploreProduct>();
      if (!productsRes.error) {
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
      }
      const tMap = new Map<string, ExploreTrust>();
      if (!badgeRes.error) {
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
      }

      return rows.map((r) => ({
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
        current_version: r.latest_published_version_id
          ? vMap.get(r.latest_published_version_id) ?? null
          : null,
        platforms: pMap.get(r.id) ?? [],
        product: prodMap.get(r.id) ?? null,
        trust: tMap.get(r.id) ?? null,
        owned: false,
        ownedVia: null,
      }));
    },
  });
}
