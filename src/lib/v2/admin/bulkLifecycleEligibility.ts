/**
 * Bulk lifecycle eligibility helper.
 *
 * Given a set of selected row IDs and the visible rows (with lifecycle),
 * splits them into eligible vs skipped for a given LifecycleAction using
 * the authoritative isTransitionAllowed matrix. Used by CatalogTable so
 * bulk actions never submit knowingly-invalid IDs and the confirmation
 * dialog can report eligible/skipped counts before applying.
 */
import { isTransitionAllowed, type Lifecycle, type LifecycleAction } from "./lifecycleTransitions";

export interface EligibilityRow {
  id: string;
  lifecycle: Lifecycle;
}

export interface Eligibility {
  eligibleIds: string[];
  skippedIds: string[];
  eligibleCount: number;
  skippedCount: number;
  totalSelected: number;
}

export function computeBulkEligibility(
  selectedIds: Iterable<string>,
  visibleRows: EligibilityRow[],
  action: LifecycleAction,
): Eligibility {
  const sel = new Set(selectedIds);
  const byId = new Map(visibleRows.map((r) => [r.id, r.lifecycle]));
  const eligible: string[] = [];
  const skipped: string[] = [];
  for (const id of sel) {
    const life = byId.get(id);
    if (life && isTransitionAllowed(life, action)) eligible.push(id);
    else skipped.push(id);
  }
  return {
    eligibleIds: eligible,
    skippedIds: skipped,
    eligibleCount: eligible.length,
    skippedCount: skipped.length,
    totalSelected: sel.size,
  };
}

export function hasAnyEligible(
  selectedIds: Iterable<string>,
  visibleRows: EligibilityRow[],
  action: LifecycleAction,
): boolean {
  return computeBulkEligibility(selectedIds, visibleRows, action).eligibleCount > 0;
}
