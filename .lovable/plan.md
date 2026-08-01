# Investigation: stale routes in the Lovable page picker

Investigation only — no files were changed, nothing was committed, deployed, published, or altered in Supabase.

## What the source actually declares today

Verified at the current checkout:

- `src/App.tsx` declares exactly six static admin destinations: index (`/admin`), `content/*`, `commerce`, `people`, `operations`, `settings`, plus one wildcard `path="*"` -> `AdminCompatibilityResolver`.
- Public/customer routes come from the static array in `src/config/routes.ts`, plus one wildcard `path="*"` -> `PublicRouteResolver`.
- No `<Route>` element anywhere declares `/admin/abandoned-cart`, `/admin/ai-studio`, `/admin/catalog/*`, `/dashboard`, or `/favorites`.

So the router is already correct. The picker is not reflecting the router.

## Why the picker is still stale — two independent causes

**1. The picker's page registry is a stored, additive manifest, not a live read of `App.tsx`.**
It is produced by Lovable's indexing pass and persisted per project. Removing a `<Route>` produces no "route deleted" signal, so previously indexed entries survive until the registry is rebuilt from scratch. This alone explains entries that exist in no current file.

**2. Even a full rebuild would re-discover most of these paths, because the strings still exist in source.**
The indexer matches route-like path literals, and the current code intentionally keeps large legacy path tables:

- `src/pages/admin/layout/AdminWorkspacePage.tsx` — ~40 legacy keys (`catalog/skills`, `catalog/prompts`, `catalog/image-styles`, `publishing/review`, `orders/refunds`, `trust/scans`, `settings/roles`, `emails/templates`, …) used by the compatibility resolver.
- `src/components/v2/PublicRouteResolver.tsx` — `LEGACY_PUBLIC_PATHS` containing `/dashboard`, `/favorites`, `/prompts`, `/skills`, `/bundles`, `/payment-*`, …
- `src/pages/v2/DashboardRedirect.tsx`, `src/components/layout/header.tsx`, `src/pages/admin/sections/ai-studio/*`, `imports/ai-studio` splat handling in the workspace resolver.
- Contract tests (`adminWorkspaceRouting.test.ts`, `ImportsHub.contract.test.ts`, `publicShell.test.ts`) that assert those exact literals.
- `public/_redirects` (inert on Lovable hosting, but still a path-bearing file).

These are deliberate compatibility surfaces and must not be deleted — removing them would break old bookmarks and fail existing tests.

## Exact safest action

Do nothing to the routing code. The correct fix is a registry rebuild on Lovable's side, in this order of escalation:

1. **Force a fresh index pass**: make any trivial change that produces a new commit (this project already commits on every edit) and then hard-reload the Lovable editor tab so the picker refetches its manifest rather than serving the cached client copy. This resolves the common case where the manifest was rebuilt but the UI held a stale copy.
2. **If entries that exist in no file persist after that**, the stored manifest itself is stale and needs a server-side reset of the project's page registry. That is not something the app repo can trigger — request it from Lovable support with the project ID and the list of ghost paths (`/admin/abandoned-cart`, `/admin/catalog/*`, `/dashboard`, `/favorites`).
3. **Accept the remainder**: paths that still appear as literals in the compatibility tables above will legitimately reappear in any rebuild. They are redirect sources, not pages. Cosmetically suppressing them would mean deleting the compatibility maps — an availability regression, not recommended.

No Supabase, deploy, publish, or Coming Soon change is involved in any step.

## Are explicit static canonical `<Route>` declarations required?

No. The picker does not need them, and adding them would be harmful.

- The canonical set is already statically declared: six admin paths in `App.tsx` and the full public list in `routes.ts`. There is no missing declaration for the picker to read.
- The staleness is a manifest-lifecycle problem (no delete signal / cached copy), not a declaration-shape problem. Adding more `<Route>` entries adds rows to the manifest; it never removes the stale ones.
- Statically declaring the legacy paths that the two wildcard resolvers currently handle would convert dead redirect sources back into real routed pages and make the picker permanently worse.

The only declaration-shape caveat: because compatibility handling lives behind `path="*"`, a literal-only scanner cannot enumerate those targets as routes. That is the desired outcome — they should not be pages.
