import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useResourceDetail(slug: string | undefined) {
  return useQuery({
    queryKey: ["v2", "resource", slug],
    enabled: !!slug,
    staleTime: 30_000,
    queryFn: async () => {
      const { data: resource, error } = await supabase
        .from("resources")
        .select("*")
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      if (!resource) return null;
      const rid = resource.id;

      const [
        { data: version },
        { data: platforms },
        { data: guides },
        { data: license },
        { data: permissions },
        { data: products },
        badgeRes,
      ] = await Promise.all([
        resource.current_version_id
          ? supabase
              .from("resource_versions")
              .select("*")
              .eq("id", resource.current_version_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from("platform_compatibility")
          .select("*")
          .eq("resource_id", rid),
        supabase
          .from("installation_guides")
          .select("*")
          .eq("resource_id", rid),
        supabase
          .from("licenses")
          .select("*")
          .eq("resource_id", rid)
          .maybeSingle(),
        supabase
          .from("resource_permissions")
          .select("*")
          .eq("resource_id", rid)
          .eq("is_public", true),
        supabase
          .from("products")
          .select("*")
          .eq("resource_id", rid)
          .eq("is_active", true),
        supabase.rpc("get_public_resource_trust_badges", {
          resource_ids: [rid],
        }),
      ]);

      const badges = (badgeRes.data ?? []) as any[];
      return {
        resource,
        version: version ?? null,
        platforms: platforms ?? [],
        guides: guides ?? [],
        license: license ?? null,
        permissions: permissions ?? [],
        products: products ?? [],
        trust: badges[0] ?? null,
      };
    },
  });
}
