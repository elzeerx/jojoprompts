import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Phase 5.4 — Admin discount code hooks.
 * Every call goes through SECURITY DEFINER RPCs that verify an admin role.
 * The raw v2_discount_codes table is never accessed directly from the client.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase.rpc as any;

export type DiscountStatus =
  | "active"
  | "scheduled"
  | "expired"
  | "exhausted"
  | "inactive"
  | "archived";

export interface DiscountRow {
  id: string;
  code: string;
  code_normalized: string;
  kind: "percent" | "fixed_fils";
  value: number;
  starts_at: string | null;
  expires_at: string | null;
  min_order_fils: number;
  max_total_uses: number | null;
  max_uses_per_user: number | null;
  applies_to_all: boolean;
  applies_to_lifetime: boolean;
  applicable_product_ids: string[];
  applicable_product_count: number;
  is_active: boolean;
  archived_at: string | null;
  status: DiscountStatus;
  used_count: number;
  consumed_count: number;
  created_at: string;
  updated_at: string;
}

export interface DiscountDetail extends Omit<DiscountRow, "applicable_product_count"> {
  notes: string | null;
  applicable_products: Array<{
    id: string;
    title: string;
    product_type: string;
    price_fils: number;
    is_active: boolean;
  }>;
}

export interface DiscountListParams {
  search?: string | null;
  status?: DiscountStatus | null;
  kind?: "percent" | "fixed_fils" | null;
  limit?: number;
  offset?: number;
}

export interface PagedResult<T> {
  total_count: number;
  rows: T[];
  limit: number;
  offset: number;
}

export const discountKeys = {
  list: (p: DiscountListParams) => ["admin", "v2", "discounts", "list", p] as const,
  detail: (id: string | null) => ["admin", "v2", "discounts", "detail", id] as const,
  productSearch: (q: string) => ["admin", "v2", "discounts", "products", q] as const,
};

export function useAdminDiscounts(params: DiscountListParams) {
  return useQuery({
    queryKey: discountKeys.list(params),
    queryFn: async () => {
      const { data, error } = await rpc("v2_admin_list_discounts", {
        p_search: params.search ?? null,
        p_status: params.status ?? null,
        p_kind: params.kind ?? null,
        p_limit: params.limit ?? 50,
        p_offset: params.offset ?? 0,
      });
      if (error) throw error;
      return data as PagedResult<DiscountRow>;
    },
    staleTime: 15_000,
  });
}

export function useAdminDiscount(id: string | null) {
  return useQuery({
    queryKey: discountKeys.detail(id),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await rpc("v2_admin_get_discount", { p_id: id });
      if (error) throw error;
      return data as DiscountDetail;
    },
  });
}

export interface UpsertDiscountInput {
  id?: string | null;
  code: string;
  kind: "percent" | "fixed_fils";
  value: number;
  starts_at: string | null;
  expires_at: string | null;
  min_order_fils: number;
  max_total_uses: number | null;
  max_uses_per_user: number | null;
  applies_to_all: boolean;
  applies_to_lifetime: boolean;
  applicable_product_ids: string[];
  is_active: boolean;
  notes: string | null;
}

export function useUpsertDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertDiscountInput) => {
      const { data, error } = await rpc("v2_admin_upsert_discount", {
        p_id: input.id ?? null,
        p_code: input.code,
        p_kind: input.kind,
        p_value: input.value,
        p_starts_at: input.starts_at,
        p_expires_at: input.expires_at,
        p_min_order_fils: input.min_order_fils,
        p_max_total_uses: input.max_total_uses,
        p_max_uses_per_user: input.max_uses_per_user,
        p_applies_to_all: input.applies_to_all,
        p_applies_to_lifetime: input.applies_to_lifetime,
        p_applicable_product_ids: input.applies_to_all ? [] : input.applicable_product_ids,
        p_is_active: input.is_active,
        p_notes: input.notes,
      });
      if (error) throw error;
      return data as DiscountDetail;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "v2", "discounts"] });
    },
  });
}

export function useSetDiscountActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await rpc("v2_admin_set_discount_active", {
        p_id: id,
        p_is_active: is_active,
      });
      if (error) throw error;
      return data as DiscountDetail;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "v2", "discounts"] }),
  });
}

export function useArchiveDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await rpc("v2_admin_archive_discount", { p_id: id });
      if (error) throw error;
      return data as DiscountDetail;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "v2", "discounts"] }),
  });
}

export interface ProductPickerRow {
  id: string;
  title: string;
  product_type: string;
  price_fils: number;
  is_active: boolean;
}

export function useAdminDiscountProductSearch(q: string) {
  return useQuery({
    queryKey: discountKeys.productSearch(q),
    queryFn: async () => {
      const { data, error } = await rpc("v2_admin_search_products_for_discount", {
        p_search: q || null,
        p_limit: 25,
      });
      if (error) throw error;
      return data as ProductPickerRow[];
    },
    staleTime: 30_000,
  });
}

/** Human-readable admin error labels for RPC error codes. */
export function humanizeDiscountError(err: unknown): { en: string; ar: string } {
  const raw = ((err as { message?: string })?.message ?? "").toLowerCase();
  const map: Record<string, { en: string; ar: string }> = {
    code_required: { en: "Code is required.", ar: "الرمز مطلوب." },
    invalid_kind: { en: "Invalid discount type.", ar: "نوع خصم غير صالح." },
    invalid_value: { en: "Discount value must be positive.", ar: "قيمة الخصم يجب أن تكون موجبة." },
    percent_out_of_range: {
      en: "Percentage must be between 1 and 100.",
      ar: "النسبة يجب أن تكون بين 1 و 100.",
    },
    invalid_min_order: {
      en: "Minimum order value cannot be negative.",
      ar: "الحد الأدنى للطلب لا يمكن أن يكون سالبًا.",
    },
    invalid_max_total_uses: {
      en: "Max total uses must be greater than 0.",
      ar: "الحد الأقصى للاستخدام يجب أن يكون أكبر من 0.",
    },
    invalid_max_uses_per_user: {
      en: "Max uses per user must be greater than 0.",
      ar: "الحد الأقصى لكل مستخدم يجب أن يكون أكبر من 0.",
    },
    window_invalid: {
      en: "Expiry must be after the start date.",
      ar: "تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية.",
    },
    scope_products_required: {
      en: "Select at least one product or choose ‘apply to all’.",
      ar: "اختر منتجًا واحدًا على الأقل أو حدد ‘يطبق على الكل’.",
    },
    unknown_products: {
      en: "Some selected products no longer exist.",
      ar: "بعض المنتجات المختارة لم تعد موجودة.",
    },
    code_conflict: {
      en: "Another active discount already uses this code.",
      ar: "يوجد خصم آخر فعال يستخدم هذا الرمز.",
    },
    used_code_immutable_fields: {
      en: "Code, type, value and lifetime flag cannot change after first use — archive and create a new code instead.",
      ar: "لا يمكن تغيير الرمز أو النوع أو القيمة أو خيار الاشتراك مدى الحياة بعد أول استخدام — قم بأرشفة الرمز وإنشاء رمز جديد.",
    },
    archived_immutable: {
      en: "Archived discounts cannot be modified.",
      ar: "لا يمكن تعديل الخصومات المؤرشفة.",
    },
    not_found: { en: "Discount not found.", ar: "الخصم غير موجود." },
    forbidden: { en: "Admin access required.", ar: "يلزم صلاحية المسؤول." },
    unauthenticated: { en: "Please sign in again.", ar: "يرجى تسجيل الدخول مجددًا." },
  };
  for (const key of Object.keys(map)) {
    if (raw.includes(key)) return map[key];
  }
  return { en: "Something went wrong.", ar: "حدث خطأ ما." };
}
