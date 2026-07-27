/**
 * Lifecycle transition matrix for V2 resources (Admin only).
 *
 * Pure derivation used by CatalogTable + tests so the UI exposes only valid
 * transitions per current lifecycle state. The server (admin_publish_resource,
 * admin_transition_resource_lifecycle) remains the sole authority — this table
 * is a strict subset of what the server accepts and never *widens* permissions.
 *
 * Documented safe restore contract: restore always returns an archived
 * resource to `draft` (never silently republishes). See migration
 * 20260727_lifecycle_audit_hardening.
 */
export type Lifecycle = "draft" | "review" | "published" | "archived";
export type LifecycleAction = "review" | "publish" | "archive" | "restore";

const MATRIX: Record<Lifecycle, LifecycleAction[]> = {
  draft:     ["review", "publish", "archive"],
  review:    ["publish", "archive"],
  published: ["archive"],
  archived:  ["restore"],
};

export function allowedActions(current: Lifecycle): LifecycleAction[] {
  return MATRIX[current] ?? [];
}

export function isTransitionAllowed(current: Lifecycle, action: LifecycleAction): boolean {
  return allowedActions(current).includes(action);
}

/**
 * The resulting lifecycle after applying `action` to a resource currently in
 * `current`. Returns null when the transition is not allowed. Publish from
 * draft/review yields `published`; restore always yields `draft` (safe state).
 */
export function nextLifecycle(current: Lifecycle, action: LifecycleAction): Lifecycle | null {
  if (!isTransitionAllowed(current, action)) return null;
  switch (action) {
    case "review":   return "review";
    case "publish":  return "published";
    case "archive":  return "archived";
    case "restore":  return "draft";
  }
}

/** Actions that must show a confirmation dialog in the UI. */
export const CONFIRM_REQUIRED: LifecycleAction[] = ["publish", "archive"];

export function requiresConfirmation(action: LifecycleAction): boolean {
  return CONFIRM_REQUIRED.includes(action);
}
