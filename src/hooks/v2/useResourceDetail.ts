import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Explicit safe column lists. Never select protected legacy payload
// fields here — those are gated behind the SECURITY DEFINER RPC
// `v2_get_entitled_resource_content` and only fetched when an owner is
// signed in.
const RESOURCE_PUBLIC_COLUMNS = [
  "id",
  "slug",
  "type",
  "lifecycle",
  "title_en",
  "title_ar",
  "summary_en",
  "summary_ar",
  "description_en",
  "description_ar",
  "hero_image_path",
  "tags",
  "category",
  "effort_minutes",
  "current_version_id",
  "legacy_prompt_id",
  "examples_en",
  "examples_ar",
  "limitations_en",
  "limitations_ar",
  "uninstall_en",
  "uninstall_ar",
  "support_en",
  "support_ar",
  "update_info_en",
  "update_info_ar",
  "published_at",
  "created_at",
  "updated_at",
].join(", ");

const RESOURCE_VERSION_COLUMNS =
  "id, resource_id, version, changelog_en, changelog_ar, published_at, created_at, updated_at";
const PLATFORM_COMPAT_COLUMNS =
  "id, resource_id, platform_slug, min_version, notes_en, notes_ar, is_verified";
const INSTALL_GUIDE_COLUMNS =
  "id, resource_id, platform_slug, estimated_minutes, steps_en, steps_ar";
const RESOURCE_PERMISSION_COLUMNS =
  "id, resource_id, kind, key, label_en, label_ar, is_required, is_public";
const LICENSE_COLUMNS =
  "id, resource_id, license_key, terms_en, terms_ar, allows_commercial, allows_redistribution";
const PRODUCT_PUBLIC_COLUMNS =
  "id, resource_id, product_type, price_fils, currency, is_active";

export function useResourceDetail(slug: string | undefined) {
  return useQuery({
    queryKey: ["v2", "resource", slug],
    enabled: !!slug,
    staleTime: 30_000,
    queryFn: async () => {
      const { data: resource, error } = await supabase
        .from("resources")
        .select(RESOURCE_PUBLIC_COLUMNS)
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      if (!resource) return null;
      const rec = resource as unknown as { id: string; current_version_id: string | null };
      const rid = rec.id;
      const currentVersionId = rec.current_version_id;

      const [
        versionResult,
        platformsResult,
        guidesResult,
        licenseResult,
        permissionsResult,
        productsResult,
        badgeRes,
      ] = await Promise.all([
        currentVersionId
          ? supabase
              .from("resource_versions")
              .select(RESOURCE_VERSION_COLUMNS)
              .eq("id", currentVersionId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from("platform_compatibility")
          .select(PLATFORM_COMPAT_COLUMNS)
          .eq("resource_id", rid),
        supabase
          .from("installation_guides")
          .select(INSTALL_GUIDE_COLUMNS)
          .eq("resource_id", rid),
        supabase
          .from("licenses")
          .select(LICENSE_COLUMNS)
          .eq("resource_id", rid)
          .maybeSingle(),
        supabase
          .from("resource_permissions")
          .select(RESOURCE_PERMISSION_COLUMNS)
          .eq("resource_id", rid)
          .eq("is_public", true),
        supabase
          .from("products")
          .select(PRODUCT_PUBLIC_COLUMNS)
          .eq("resource_id", rid)
          .eq("is_active", true),
        supabase.rpc("get_public_resource_trust_badges", {
          resource_ids: [rid],
        }),
      ]);

      for (const result of [
        versionResult,
        platformsResult,
        guidesResult,
        licenseResult,
        permissionsResult,
        productsResult,
        badgeRes,
      ]) {
        if (result.error) throw result.error;
      }

      const badges = (badgeRes.data ?? []) as Array<Record<string, unknown>>;
      return {
        resource,
        version: versionResult.data ?? null,
        platforms: platformsResult.data ?? [],
        guides: guidesResult.data ?? [],
        license: licenseResult.data ?? null,
        permissions: permissionsResult.data ?? [],
        products: productsResult.data ?? [],
        trust: badges[0] ?? null,
      };
    },
  });
}
