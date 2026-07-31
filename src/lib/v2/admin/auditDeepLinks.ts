/**
 * Resolve an admin deep-link for an audit-log entity reference, if any.
 * Pure function — safe to unit test. Returns null when no admin route
 * is a stable home for that entity type.
 */
export function resolveEntityLink(
  entityType: string | null | undefined,
  entityId: string | null | undefined
): string | null {
  if (!entityType || !entityId) return null;
  const id = String(entityId);
  switch (entityType) {
    case "report":
      return `/admin/operations?tab=reports&open=${encodeURIComponent(id)}`;
    case "order":
      return `/admin/commerce?tab=orders&open=${encodeURIComponent(id)}`;
    case "refund":
      return `/admin/commerce?tab=refunds&open=${encodeURIComponent(id)}`;
    case "discount":
    case "discount_code":
      return `/admin/commerce?tab=discounts&open=${encodeURIComponent(id)}`;
    case "resource":
      return `/admin/content?tab=versions&resource=${encodeURIComponent(id)}`;
    case "resource_version":
      return `/admin/content?tab=versions&version=${encodeURIComponent(id)}`;
    case "package_scan":
      return `/admin/operations?tab=scans&open=${encodeURIComponent(id)}`;
    case "user":
    case "profile":
      return `/admin/people?tab=users&open=${encodeURIComponent(id)}`;
    default:
      return null;
  }
}

/** Short 8-char id chip for dense tables. */
export function shortId(id: string | null | undefined): string {
  if (!id) return "—";
  return id.slice(0, 8);
}
