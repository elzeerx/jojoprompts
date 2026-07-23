/**
 * Re-fetches authoritative product / resource / ownership info for the current
 * cart's product IDs. Never trusts client-side price snapshots.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "./useCart";
import { useLibraryState } from "./useLibraryState";

export interface AuthoritativeCartLine {
  product_id: string;
  status:
    | "ok"
    | "inactive"
    | "missing"
    | "owned"
    | "included_with_lifetime";
  product_type: "individual" | "bundle" | "lifetime" | "free" | null;
  price_fils: number;
  resource_id: string | null;
  resource_slug: string | null;
  title_en: string;
  title_ar: string | null;
  resource_type: string | null;
}

export interface AuthoritativeCart {
  lines: AuthoritativeCartLine[];
  chargeableIds: string[];
  chargeableTotalFils: number;
  hasBlockers: boolean;
}

export function useAuthoritativeCart() {
  const { items } = useCart();
  const { data: library } = useLibraryState();
  const ownedResourceIds = new Set(
    (library?.entitlements ?? [])
      .filter((e) => e.scope === "resource" && !e.expires_at)
      .map((e) => e.resource_id)
      .filter((x): x is string => !!x),
  );
  const hasLibrary = !!library?.has_library_access;

  const productIds = items.map((i) => i.product_id).sort();

  return useQuery<AuthoritativeCart>({
    queryKey: ["v2", "cart", "authoritative", productIds, hasLibrary, Array.from(ownedResourceIds).sort()],
    staleTime: 15_000,
    queryFn: async () => {
      if (productIds.length === 0) {
        return { lines: [], chargeableIds: [], chargeableTotalFils: 0, hasBlockers: false };
      }
      const { data: productRows, error } = await supabase
        .from("products")
        .select("id, product_type, price_fils, is_active, resource_id")
        .in("id", productIds);
      if (error) throw error;
      const products = (productRows ?? []) as Array<{
        id: string;
        product_type: "individual" | "bundle" | "lifetime" | "free";
        price_fils: number;
        is_active: boolean;
        resource_id: string | null;
      }>;
      const linkedResourceIds = Array.from(
        new Set(products.map((p) => p.resource_id).filter((x): x is string => !!x)),
      );
      let resourcesById = new Map<string, { id: string; slug: string; type: string; title_en: string; title_ar: string | null }>();
      if (linkedResourceIds.length > 0) {
        const { data: rrows } = await supabase
          .from("resources")
          .select("id, slug, type, title_en, title_ar")
          .in("id", linkedResourceIds);
        (rrows ?? []).forEach((r: any) => resourcesById.set(r.id, r));
      }

      const byId = new Map<string, typeof products[number]>();
      products.forEach((p) => byId.set(p.id, p));

      // For bundles, expand member resources to detect lifetime coverage.
      const bundleIds = products
        .filter((p) => p.product_type === "bundle")
        .map((p) => p.id);
      let bundleItems: Array<{ product_id: string; resource_id: string }> = [];
      if (bundleIds.length > 0) {
        const { data: bi } = await (supabase as any)
          .from("product_bundle_items")
          .select("product_id, resource_id")
          .in("product_id", bundleIds);
        bundleItems = (bi ?? []) as Array<{ product_id: string; resource_id: string }>;
      }
      const bundleMembers = new Map<string, string[]>();
      bundleItems.forEach((row) => {
        const arr = bundleMembers.get(row.product_id) ?? [];
        arr.push(row.resource_id);
        bundleMembers.set(row.product_id, arr);
      });

      const lines: AuthoritativeCartLine[] = items.map((cartItem) => {
        const p = byId.get(cartItem.product_id);
        const snap = cartItem.snapshot;
        if (!p) {
          return {
            product_id: cartItem.product_id,
            status: "missing",
            product_type: null,
            price_fils: 0,
            resource_id: null,
            resource_slug: null,
            title_en: snap.title_en,
            title_ar: snap.title_ar,
            resource_type: snap.resource_type,
          };
        }
        const linkedResource = p.resource_id ? resourcesById.get(p.resource_id) : null;
        const base = {
          product_id: p.id,
          product_type: p.product_type,
          price_fils: p.price_fils ?? 0,
          resource_id: p.resource_id,
          resource_slug: linkedResource?.slug ?? null,
          title_en: linkedResource?.title_en ?? snap.title_en,
          title_ar: linkedResource?.title_ar ?? snap.title_ar,
          resource_type: linkedResource?.type ?? snap.resource_type,
        };
        if (!p.is_active) return { ...base, status: "inactive" as const };
        if (hasLibrary && p.product_type !== "lifetime") {
          return { ...base, status: "included_with_lifetime" as const };
        }
        if (p.product_type === "individual" && p.resource_id && ownedResourceIds.has(p.resource_id)) {
          return { ...base, status: "owned" as const };
        }
        if (p.product_type === "bundle") {
          const members = bundleMembers.get(p.id) ?? [];
          if (members.length > 0 && members.every((rid) => ownedResourceIds.has(rid))) {
            return { ...base, status: "owned" as const };
          }
        }
        return { ...base, status: "ok" as const };
      });

      const chargeable = lines.filter((l) => l.status === "ok");
      return {
        lines,
        chargeableIds: chargeable.map((l) => l.product_id),
        chargeableTotalFils: chargeable.reduce((s, l) => s + l.price_fils, 0),
        hasBlockers: lines.some((l) => l.status !== "ok"),
      };
    },
  });
}
