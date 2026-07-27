/**
 * SOURCE FIXTURE — V2 foreign-key indexes.
 *
 * These migrations HAVE BEEN APPLIED LIVE. This file is retained as a
 * version-controlled, testable record of the applied index catalog so
 * the intended set can be diffed against the database at any time.
 *
 * APPLIED LIVE MIGRATIONS (do NOT create duplicate executable
 * migration files for these — they already exist in the database
 * catalog):
 *
 *   • 20260727140438 add_v2_foreign_key_indexes
 *       Ten unindexed V2 foreign keys covered:
 *         cart_items.product_id
 *         entitlements.resource_id
 *         order_items.product_id
 *         order_items.resource_id
 *         order_items.resource_version_id
 *         orders.legacy_transaction_id
 *         package_scan_items.resource_file_id
 *         package_scans.requested_by
 *         product_bundle_items.resource_id
 *         resources.current_version_id
 *
 *   • 20260727140552 add_remaining_v2_foreign_key_indexes
 *       Five remaining unindexed V2 foreign keys covered:
 *         v2_discount_codes.archived_by
 *         v2_discount_codes.created_by
 *         v2_discount_codes.updated_by
 *         v2_discount_redemptions.user_id
 *         user_roles.assigned_by
 *
 * Guarantees:
 *   • CREATE INDEX IF NOT EXISTS everywhere — safe to re-run.
 *   • No DROP, no data change, no RLS/grant change.
 */

export const V2_FK_INDEXES_MIGRATION_FILENAME =
  "20260727140438_add_v2_foreign_key_indexes.sql";

export const V2_FK_INDEXES_REMAINING_MIGRATION_FILENAME =
  "2026072714xx_add_remaining_v2_foreign_key_indexes.sql";

export const V2_FK_INDEXES_APPLIED_LIVE = [
  {
    version: "20260727140438",
    name: "add_v2_foreign_key_indexes",
    applied: true,
  },
  {
    version: "2026072714xx",
    name: "add_remaining_v2_foreign_key_indexes",
    applied: true,
    exactTimestampPending: true,
  },
] as const;

export interface TargetedIndex {
  index: string;
  table: string;
  column: string;
  /** Which applied migration created the index. */
  migration: "add_v2_foreign_key_indexes" | "add_remaining_v2_foreign_key_indexes";
}

export const TARGETED_FK_INDEXES: TargetedIndex[] = [
  // 20260727140438 add_v2_foreign_key_indexes
  { index: "cart_items_product_idx",            table: "cart_items",           column: "product_id",           migration: "add_v2_foreign_key_indexes" },
  { index: "entitlements_resource_idx",         table: "entitlements",         column: "resource_id",          migration: "add_v2_foreign_key_indexes" },
  { index: "order_items_product_idx",           table: "order_items",          column: "product_id",           migration: "add_v2_foreign_key_indexes" },
  { index: "order_items_resource_idx",          table: "order_items",          column: "resource_id",          migration: "add_v2_foreign_key_indexes" },
  { index: "order_items_resource_version_idx",  table: "order_items",          column: "resource_version_id",  migration: "add_v2_foreign_key_indexes" },
  { index: "orders_legacy_transaction_idx",     table: "orders",               column: "legacy_transaction_id",migration: "add_v2_foreign_key_indexes" },
  { index: "package_scan_items_file_idx",       table: "package_scan_items",   column: "resource_file_id",     migration: "add_v2_foreign_key_indexes" },
  { index: "package_scans_requested_by_idx",    table: "package_scans",        column: "requested_by",         migration: "add_v2_foreign_key_indexes" },
  { index: "product_bundle_items_resource_idx", table: "product_bundle_items", column: "resource_id",          migration: "add_v2_foreign_key_indexes" },
  { index: "resources_current_version_idx",     table: "resources",            column: "current_version_id",   migration: "add_v2_foreign_key_indexes" },
  // 2026072714xx add_remaining_v2_foreign_key_indexes
  { index: "v2_discount_codes_archived_by_idx",    table: "v2_discount_codes",       column: "archived_by",  migration: "add_remaining_v2_foreign_key_indexes" },
  { index: "v2_discount_codes_created_by_idx",     table: "v2_discount_codes",       column: "created_by",   migration: "add_remaining_v2_foreign_key_indexes" },
  { index: "v2_discount_codes_updated_by_idx",     table: "v2_discount_codes",       column: "updated_by",   migration: "add_remaining_v2_foreign_key_indexes" },
  { index: "v2_discount_redemptions_user_idx",     table: "v2_discount_redemptions", column: "user_id",      migration: "add_remaining_v2_foreign_key_indexes" },
  { index: "user_roles_assigned_by_idx",           table: "user_roles",              column: "assigned_by",  migration: "add_remaining_v2_foreign_key_indexes" },
];

function sqlFor(migration: TargetedIndex["migration"]): string {
  return TARGETED_FK_INDEXES
    .filter((i) => i.migration === migration)
    .map(
      (i) =>
        `CREATE INDEX IF NOT EXISTS ${i.index} ON public.${i.table}(${i.column});`,
    )
    .join("\n");
}

export const V2_FK_INDEXES_SQL = `-- V2 pre-launch (APPLIED): additive indexes for previously-unindexed
-- foreign keys. All statements are idempotent. No RLS, grant, or data
-- change.
${sqlFor("add_v2_foreign_key_indexes")}
`;

export const V2_FK_INDEXES_REMAINING_SQL = `-- V2 pre-launch (APPLIED): remaining additive indexes for
-- previously-unindexed foreign keys. All statements are idempotent.
-- No RLS, grant, or data change.
${sqlFor("add_remaining_v2_foreign_key_indexes")}
`;

export const V2_FK_INDEXES = {
  filename: V2_FK_INDEXES_MIGRATION_FILENAME,
  sql: V2_FK_INDEXES_SQL,
  targets: TARGETED_FK_INDEXES.filter(
    (i) => i.migration === "add_v2_foreign_key_indexes",
  ),
  applied: true,
} as const;

export const V2_FK_INDEXES_REMAINING = {
  filename: V2_FK_INDEXES_REMAINING_MIGRATION_FILENAME,
  sql: V2_FK_INDEXES_REMAINING_SQL,
  targets: TARGETED_FK_INDEXES.filter(
    (i) => i.migration === "add_remaining_v2_foreign_key_indexes",
  ),
  applied: true,
  exactTimestampPending: true,
} as const;
