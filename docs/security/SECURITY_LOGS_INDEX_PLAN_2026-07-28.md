# Security Events admin — index plan for `public.security_logs` (2026-07-28)

Source-only. **No live migration, Supabase mutation, publish, or
Coming Soon change was performed in this pass.**

Drafted (not applied) migration:
`supabase/migrations/20260728123000_security_logs_admin_query_support.sql`
— the canonical body. `src/lib/v2/admin/securityLogsIndexes.sql.ts`
carries an embedded mirror (`SECURITY_LOGS_INDEXES_SQL`) that the
contract test compares to the physical file for normalized byte parity.


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

## Schema normalization (distinct from indexing)

The same drafted migration also carries a **bounded one-time
`UPDATE`** on `public.security_logs` to normalize legacy
`details->>'severity'` values into the authoritative top-level
`severity` column. This is a data fix, not an index change — the
dashboard already reads only the top-level columns and this pass does
**not** reintroduce JSON filtering anywhere in the UI or query paths.

### Live evidence at draft time

- 53,865 total rows.
- 117 rows carry `details->>'severity'`; **all 117 disagree** with the
  top-level `severity`:
  - 65 rows: top-level `info`, details `medium`
  - 52 rows: top-level `info`, details `high`
- 0 rows carry `details->>'event_category'` — no category backfill is
  required or performed.
- Consequence today: recent `suspicious_activity` rows appear as
  top-level `severity = 'info'`, so the corrected
  `severity = 'high'` (7d) filter returns zero until this normalization
  runs.

### Scope, guards, and idempotence

```sql
UPDATE public.security_logs
SET severity = details->>'severity'
WHERE severity = 'info'
  AND details->>'severity' IN ('medium','high','critical');
```

- Only rows whose top-level severity is exactly `'info'` are eligible;
  non-`info` authoritative values are never overwritten.
- The details value must be in the explicit allowlist
  `('medium','high','critical')`. Arbitrary strings are ignored so a
  stray tag cannot promote a row to an unknown severity.
- `event_category` is not touched.
- After the first apply the WHERE predicate no longer matches those
  rows, so a re-run is a no-op — the migration is safely idempotent.

### Preflight (informational, does not fail on drift)

```sql
SELECT count(*) AS expected_affected_rows
FROM public.security_logs
WHERE severity = 'info'
  AND details->>'severity' IN ('medium','high','critical');
-- Expected at draft time: 117 (65 medium + 52 high, 0 critical).
```

Future environments may legitimately show a different count. The
migration does not assert on this number.

### Post-apply verification (REQUIRED before declaring the fix live)

1. Re-run the preflight query — expect `0`.
2. From the Security Events dashboard, apply the 7d window and
   `severity = high` filter and confirm the previously-hidden
   `suspicious_activity` rows now appear.
3. Then re-run `EXPLAIN (ANALYZE, BUFFERS)` on Q1–Q4 above to verify
   the index plans (a separate concern from the normalization).

## Rollback

```sql
-- Indexes
DROP INDEX IF EXISTS public.idx_security_logs_created_at_desc;
DROP INDEX IF EXISTS public.idx_security_logs_actionable_created_at;
DROP INDEX IF EXISTS public.idx_security_logs_action;

-- Normalization: no automatic rollback. The prior top-level 'info'
-- values are lost; the details JSON retains the original severity tag
-- and can be inspected if a reversal is ever needed.
```

## Files added / amended this pass

- `src/lib/v2/admin/securityLogsIndexes.sql.ts` — drafted migration SQL: planned indexes + bounded severity normalization UPDATE.
- `src/lib/v2/admin/securityLogsIndexes.test.ts` — contract tests (idempotency, no duplicates of existing indexes, exact partial-index predicate, order direction, normalization allowlist / `severity='info'` guard / no `event_category` backfill / idempotence).
- `docs/security/SECURITY_LOGS_INDEX_PLAN_2026-07-28.md` — this note.

## Confirmation

**No live migration was applied. No Supabase objects were mutated. No
Edge Functions were deployed or edited. The site was not published.
The Coming Soon launch lock was not disabled.**
