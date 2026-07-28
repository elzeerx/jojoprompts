# Security Events admin — index plan for `public.security_logs` (2026-07-28)

Source-only. **No live migration, Supabase mutation, publish, or
Coming Soon change was performed in this pass.**

Drafted (not applied) migration:
`20260728123000_security_logs_admin_query_indexes.sql`
(SQL body embedded in
`src/lib/v2/admin/securityLogsIndexes.sql.ts` under
`SECURITY_LOGS_INDEXES_SQL`).

## Table snapshot (live evidence)

- `public.security_logs` — ~52k rows, ~23 MB.
- Existing indexes: `security_logs_pkey (id)`,
  `idx_security_logs_category (event_category)`,
  `idx_security_logs_severity (severity)`.
- No index on `created_at` or `action`.

## Before-plan evidence

Default dashboard query (24h window, noise excluded, ordered, LIMIT 50):

```sql
SELECT id, created_at, user_id, event_type, action, severity,
       event_category, details, ip_address, user_agent
FROM public.security_logs
WHERE created_at >= now() - interval '24 hours'
  AND action NOT IN ('route_access','developer_tools_opened')
ORDER BY created_at DESC
LIMIT 50;
```

`EXPLAIN` (live, before this migration): **Seq Scan on
`public.security_logs`** followed by a top-N Sort, startup cost
≈ **3558.54**. Neither the time window nor the ordering is
index-supported; the noise-exclusion predicate is not selective enough
by itself to change that plan.

## Planned indexes (three, minimal)

| # | Index                                       | Definition                                                                                                                                          | Query it serves |
|---|---------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------|-----------------|
| 1 | `idx_security_logs_created_at_desc`         | `CREATE INDEX IF NOT EXISTS ... ON public.security_logs (created_at DESC)`                                                                          | All-events list + 24h metric counts; composes with existing severity / category indexes via bitmap AND. |
| 2 | `idx_security_logs_actionable_created_at`   | `CREATE INDEX IF NOT EXISTS ... ON public.security_logs (created_at DESC) WHERE action NOT IN ('route_access','developer_tools_opened')`            | Default dashboard list (hot path). Partial index sized to the actionable subset only. |
| 3 | `idx_security_logs_action`                  | `CREATE INDEX IF NOT EXISTS ... ON public.security_logs (action)`                                                                                   | Explicit action-slug drill-down filter. |

Notes:

- No composite `(severity, created_at)` / `(event_category, created_at)`
  — the existing single-column indexes already exist and can be
  combined with (1) by the planner. Adding wide composites would
  duplicate coverage on an append-heavy table.
- No JSONB / `details` index — the corrected dashboard reads top-level
  `severity` and `event_category` columns.
- No `CONCURRENTLY` — cannot run inside a migration transaction.

## Expected plan improvement (unverified until applied)

- **Q1** (default noise-excluded list): expected `Index Scan Backward
  using idx_security_logs_actionable_created_at` with the time bound
  applied as an index condition and no explicit Sort. Startup cost
  should drop by an order of magnitude on this row count.
- **Q2** (all-events list): expected `Index Scan Backward using
  idx_security_logs_created_at_desc`.
- **Q3** (24h metric counts): expected `Index Only Scan` /
  `Bitmap Index Scan` on the same `created_at` index, optionally
  combined with `idx_security_logs_severity`.
- **Q4** (explicit action filter): expected `Bitmap And` of
  `idx_security_logs_action` and `idx_security_logs_created_at_desc`.

**This is a hypothesis, not a claim.** After application, re-run
`EXPLAIN (ANALYZE, BUFFERS)` on Q1–Q4 and confirm the intended index
is chosen before declaring any improvement.

## Write overhead

`security_logs` is append-only. Three additional B-tree indexes (one
partial) add roughly three index inserts per event. Acceptable given
the read-side wins.

## Rollback

```sql
DROP INDEX IF EXISTS public.idx_security_logs_created_at_desc;
DROP INDEX IF EXISTS public.idx_security_logs_actionable_created_at;
DROP INDEX IF EXISTS public.idx_security_logs_action;
```

## Files added this pass

- `src/lib/v2/admin/securityLogsIndexes.sql.ts` — drafted migration SQL + planned index list.
- `src/lib/v2/admin/securityLogsIndexes.test.ts` — contract tests (idempotency, no duplicates of existing indexes, exact partial-index predicate, order direction).
- `docs/security/SECURITY_LOGS_INDEX_PLAN_2026-07-28.md` — this note.

## Confirmation

**No live migration was applied. No Supabase objects were mutated. No
Edge Functions were deployed or edited. The site was not published.
The Coming Soon launch lock was not disabled.**
