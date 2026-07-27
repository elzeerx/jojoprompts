/**
 * SOURCE FIXTURE — pre-launch performance preparation: additive
 * CREATE INDEX IF NOT EXISTS statements for still-unindexed V2
 * foreign keys.
 *
 * NOT applied to production in this pass. Held as a version-controlled
 * fixture with tests so the exact intended index set can be reviewed
 * and applied later without duplicating any index that already exists.
 *
 * Intended future filename:
 *   supabase/migrations/20260728020000_v2_fk_indexes.sql
 *
 * Audit basis (repo-local scan of supabase/migrations/):
 *   Existing indexes that we DO NOT recreate:
 *     • package_scans_version_idx           (package_scans.resource_version_id)
 *     • order_items_order_idx               (order_items.order_id)
 *     • entitlements_user_idx / entitlements_user_resource_idx
 *     • entitlements_source_order_item_idx / _active_lookup_idx / _active_library_idx / _active_collection_idx
 *     • package_scan_items_pending_next_poll (partial)
 *     • resources_lifecycle_idx / _type_lifecycle_idx / _published_at_idx / _tags_gin_idx
 *     • orders_status_idx
 *
 *   The columns in TARGETED_FK_INDEXES below have NO existing index
 *   covering the FK column as the leading key.
 *
 * Guarantees for the future application:
 *   • CREATE INDEX IF NOT EXISTS — safe to re-run.
 *   • No DROP, no data change, no RLS/grant change.
 *   • Runs concurrently is intentionally NOT used inside the file
 *     because Supabase migration tool wraps in a transaction; if
 *     online build is required, the runbook can switch to
 *     CREATE INDEX CONCURRENTLY outside of a migration.
 */

export const V2_FK_INDEXES_MIGRATION_FILENAME =
  "20260728020000_v2_fk_indexes.sql";

export interface TargetedIndex {
  index: string;
  table: string;
  column: string;
}

export const TARGETED_FK_INDEXES: TargetedIndex[] = [
  { index: "cart_items_product_idx",           table: "cart_items",           column: "product_id" },
  { index: "entitlements_resource_idx",        table: "entitlements",         column: "resource_id" },
  { index: "order_items_product_idx",          table: "order_items",          column: "product_id" },
  { index: "order_items_resource_idx",         table: "order_items",          column: "resource_id" },
  { index: "order_items_resource_version_idx", table: "order_items",          column: "resource_version_id" },
  { index: "orders_legacy_transaction_idx",    table: "orders",               column: "legacy_transaction_id" },
  { index: "package_scan_items_file_idx",      table: "package_scan_items",   column: "resource_file_id" },
  { index: "package_scans_requested_by_idx",   table: "package_scans",        column: "requested_by" },
  { index: "product_bundle_items_resource_idx",table: "product_bundle_items", column: "resource_id" },
  { index: "resources_current_version_idx",    table: "resources",            column: "current_version_id" },
];

export const V2_FK_INDEXES_SQL = `-- V2 pre-launch: additive indexes for still-unindexed foreign keys.
-- All statements are idempotent. No RLS, grant, or data change.
${TARGETED_FK_INDEXES.map(
  (i) =>
    `CREATE INDEX IF NOT EXISTS ${i.index} ON public.${i.table}(${i.column});`,
).join("\n")}
`;

export const V2_FK_INDEXES = {
  filename: V2_FK_INDEXES_MIGRATION_FILENAME,
  sql: V2_FK_INDEXES_SQL,
  targets: TARGETED_FK_INDEXES,
} as const;
