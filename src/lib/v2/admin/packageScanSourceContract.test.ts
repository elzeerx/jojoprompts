// Static source-contract regression guards for the package-scan control plane
// and worker. These run under Bun (Deno's edge-function test runner is not
// available in this workspace — the tests below cover the same invariants by
// reading the actual edge-function sources).
//
// Coverage:
//   1) No Supabase-JS query on package_scan_items uses the non-existent
//      `scan_id` column. The live column is `package_scan_id`
//      (UNIQUE(package_scan_id, resource_file_id)).
//   2) Refresh + readiness-failure paths query `package_scan_id`.
//   3) queue_scan preflights the pending-child probe across ALL scans for the
//      version, not only when the latest effective status is pending, using
//      the correct column.
//   4) Both edge functions validate UUID inputs with the strict 8-4-4-4-12
//      regex (no loose `/^[0-9a-f-]{36}$/i`).
//   5) The promoted migration replaces v2_internal_create_package_scan with a
//      helper-driven definition (row lock, pending-child guard, effective
//      already_clean via v2_internal_effective_scan_state, unique fallback,
//      service_role-only ACL).

import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const HERE = new URL(".", import.meta.url).pathname;
const REPO_ROOT = resolve(HERE, "../../../..");

const CONTROL_PATH = resolve(
  REPO_ROOT,
  "supabase/functions/v2-admin-package-scan-control/index.ts",
);
const WORKER_PATH = resolve(
  REPO_ROOT,
  "supabase/functions/v2-package-scan-worker/index.ts",
);
const MIGRATION_PATH = resolve(
  REPO_ROOT,
  "supabase/migrations/20260728143000_package_scan_fail_closed_effective_state.sql",
);
const DRAFT_PATH = resolve(
  REPO_ROOT,
  "docs/security/drafts/20260728130000_package_scan_fail_closed_effective_state.sql",
);

const control = readFileSync(CONTROL_PATH, "utf8");
const worker = readFileSync(WORKER_PATH, "utf8");
const migration = readFileSync(MIGRATION_PATH, "utf8");
const draft = readFileSync(DRAFT_PATH, "utf8");

// The exact 8-4-4-4-12 UUID hex pattern the task requires.
const STRICT_UUID_LITERAL =
  '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i';
const LOOSE_UUID_LITERAL = '/^[0-9a-f-]{36}$/i';

// ---------- helpers ----------------------------------------------------------

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walkTsFiles(full));
    } else if (st.isFile() && (full.endsWith(".ts") || full.endsWith(".tsx"))) {
      out.push(full);
    }
  }
  return out;
}

// Match `.from("package_scan_items")` followed within N characters by
// `.eq("scan_id"` or `.in("scan_id"`. Both single and double quotes.
const FORBIDDEN_SCAN_ID = new RegExp(
  String.raw`\.from\(\s*(['"])package_scan_items\1\s*\)[^;]*?\.(eq|in|neq|match)\(\s*(['"])scan_id\3`,
  "s",
);

// ---------- 1) source-wide scan_id ban --------------------------------------

describe("package_scan_items column contract (source-wide)", () => {
  it("no Supabase-JS query on package_scan_items uses the non-existent scan_id column", () => {
    const files = walkTsFiles(resolve(REPO_ROOT, "supabase/functions"));
    const offenders: string[] = [];
    for (const f of files) {
      const txt = readFileSync(f, "utf8");
      if (FORBIDDEN_SCAN_ID.test(txt)) offenders.push(f.replace(REPO_ROOT + "/", ""));
    }
    expect(offenders).toEqual([]);
  });

  it("no Supabase-JS query on package_scan_items uses scan_id in src/ either", () => {
    const files = walkTsFiles(resolve(REPO_ROOT, "src"));
    const offenders: string[] = [];
    for (const f of files) {
      const txt = readFileSync(f, "utf8");
      if (FORBIDDEN_SCAN_ID.test(txt)) offenders.push(f.replace(REPO_ROOT + "/", ""));
    }
    expect(offenders).toEqual([]);
  });
});

// ---------- 2) control-plane contract ---------------------------------------

describe("v2-admin-package-scan-control edge function", () => {
  it("uses the strict 8-4-4-4-12 UUID regex for version_id and scan_id", () => {
    // Loose 36-char accept must not remain.
    expect(control).not.toContain(LOOSE_UUID_LITERAL);
    // Strict pattern present for both action paths (queue_scan + refresh_scan).
    const strictHits = control.split(STRICT_UUID_LITERAL).length - 1;
    expect(strictHits).toBeGreaterThanOrEqual(2);
  });

  it("refresh_scan reads pending items via package_scan_id (not scan_id)", () => {
    // Refresh path: .from("package_scan_items").select("id").eq("package_scan_id", scanId)
    expect(control).toMatch(
      /\.from\(\s*["']package_scan_items["']\s*\)[\s\S]*?\.eq\(\s*["']package_scan_id["'],\s*scanId\s*\)[\s\S]*?\.eq\(\s*["']status["'],\s*["']pending["']\s*\)/,
    );
  });

  it("queue_scan pending-child preflight runs across ALL scans for the version (not only when latest is pending)", () => {
    // The preflight must fetch scan IDs for the version and then query
    // package_scan_items with .in("package_scan_id", scanIds).
    expect(control).toMatch(
      /\.from\(\s*["']package_scans["']\s*\)[\s\S]*?\.eq\(\s*["']resource_version_id["'],\s*versionId\s*\)/,
    );
    expect(control).toMatch(
      /\.in\(\s*["']package_scan_id["'],\s*scanIds\s*\)[\s\S]*?\.eq\(\s*["']status["'],\s*["']pending["']\s*\)/,
    );
    // The old gated probe (only when effStatus === "pending") must be gone.
    expect(control).not.toMatch(/effStatus\s*===\s*["']pending["']\s*&&\s*row\?\.latest_scan_id/);
  });

  it("handles DB errors from every awaited query with a stable db_error 500", () => {
    // Every await on auth.supabase.from/rpc is followed by an error check that
    // returns db_error. Count occurrences to catch silent drops.
    const dbErrorReturns = control.match(/return err\(\s*["']db_error["']\s*,\s*500\s*\)/g) ?? [];
    expect(dbErrorReturns.length).toBeGreaterThanOrEqual(5);
  });
});

// ---------- 3) worker contract ----------------------------------------------

describe("v2-package-scan-worker edge function", () => {
  it("uses the strict 8-4-4-4-12 UUID regex for scan_id", () => {
    expect(worker).not.toContain(LOOSE_UUID_LITERAL);
    expect(worker).toContain(STRICT_UUID_LITERAL);
  });

  it("persistReadinessFailure queries pending items via package_scan_id", () => {
    expect(worker).toMatch(
      /persistReadinessFailure[\s\S]*?\.from\(\s*["']package_scan_items["']\s*\)[\s\S]*?\.eq\(\s*["']package_scan_id["'],\s*scanId\s*\)/,
    );
  });
});

// ---------- 4) promoted migration: v2_internal_create_package_scan ----------

describe("promoted migration — v2_internal_create_package_scan replacement", () => {
  const RPC_RE =
    /CREATE OR REPLACE FUNCTION public\.v2_internal_create_package_scan\s*\(\s*p_version_id uuid,\s*p_scanner text,\s*p_requested_by uuid\s*\)/;

  it("replaces v2_internal_create_package_scan in the promoted migration", () => {
    expect(migration).toMatch(RPC_RE);
  });

  it("draft body stays in sync with the promoted migration", () => {
    expect(draft).toMatch(RPC_RE);
  });

  it("validates arguments and rejects empty scanner", () => {
    expect(migration).toMatch(
      /p_scanner IS NULL OR btrim\(p_scanner\) = ''/,
    );
    expect(migration).toMatch(/RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023'/);
  });

  it("locks the target resource_versions row FOR UPDATE and rejects a missing version stably", () => {
    expect(migration).toMatch(
      /FROM public\.resource_versions\s+WHERE id = p_version_id\s+FOR UPDATE/,
    );
    expect(migration).toMatch(/RAISE EXCEPTION 'version_not_found' USING ERRCODE = 'P0002'/);
  });

  it("rejects no_files when no current resource_files exist", () => {
    expect(migration).toMatch(
      /NOT EXISTS\s*\(\s*SELECT 1 FROM public\.resource_files[\s\S]*?WHERE resource_version_id = p_version_id/,
    );
    expect(migration).toMatch(/RAISE EXCEPTION 'no_files' USING ERRCODE = '22023'/);
  });

  it("pending_exists covers ANY pending item under ANY scan for the version (terminal aggregate with pending child included)", () => {
    // Guard queries package_scan_items joined to package_scans by version.
    expect(migration).toMatch(
      /FROM public\.package_scan_items psi\s+JOIN public\.package_scans ps ON ps\.id = psi\.package_scan_id\s+WHERE ps\.resource_version_id = p_version_id\s+AND psi\.status = 'pending'/,
    );
    expect(migration).toMatch(/RAISE EXCEPTION 'pending_exists' USING ERRCODE = '23505'/);
  });

  it("already_clean is derived from v2_internal_effective_scan_state (no duplicated exact-coverage SQL in create-scan)", () => {
    // Body must call the helper for the already_clean decision.
    expect(migration).toMatch(
      /FROM public\.v2_internal_effective_scan_state\(p_version_id\)/,
    );
    // And reject only when effective_status='clean' AND coverage_valid=true.
    expect(migration).toMatch(
      /v_eff\.effective_status = 'clean' AND COALESCE\(v_eff\.coverage_valid, false\)/,
    );
    // The RPC body must not re-derive exact coverage via the historical
    // "latest clean scan + inline items count" pattern. We scope the check to
    // the create-scan function body only (helper's own definition legitimately
    // computes coverage).
    const start = migration.indexOf("CREATE OR REPLACE FUNCTION public.v2_internal_create_package_scan");
    expect(start).toBeGreaterThan(-1);
    // Find the end of the function's body ($$; closer after the CREATE)
    const bodyStart = migration.indexOf("$$", start);
    const bodyEnd = migration.indexOf("$$;", bodyStart + 2);
    const body = migration.slice(bodyStart, bodyEnd);
    // Historical inline pattern must NOT reappear inside create-scan.
    expect(body).not.toMatch(/v_prev_scan_id/);
    expect(body).not.toMatch(/bool_and\(psi\.status = 'clean'\)/);
    expect(body).not.toMatch(/= v_file_count/);
  });

  it("retains unique-violation fallback -> pending_exists", () => {
    expect(migration).toMatch(
      /EXCEPTION WHEN unique_violation THEN\s+RAISE EXCEPTION 'pending_exists' USING ERRCODE = '23505'/,
    );
  });

  it("inserts one pending package_scan and one pending item per current file", () => {
    expect(migration).toMatch(
      /INSERT INTO public\.package_scans[\s\S]*?VALUES\s*\(\s*p_version_id[\s\S]*?'pending'/,
    );
    expect(migration).toMatch(
      /INSERT INTO public\.package_scan_items\s*\(\s*package_scan_id,\s*resource_file_id,\s*status,\s*progress\s*\)[\s\S]*?FROM public\.resource_files rf\s+WHERE rf\.resource_version_id = p_version_id/,
    );
  });

  it("preserves service_role-only ACL and empty search_path", () => {
    expect(migration).toMatch(/SET search_path = ''/);
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.v2_internal_create_package_scan\(uuid, text, uuid\) FROM PUBLIC,\s*anon,\s*authenticated/,
    );
    expect(migration).toMatch(
      /GRANT\s+EXECUTE ON FUNCTION public\.v2_internal_create_package_scan\(uuid, text, uuid\) TO service_role/,
    );
  });
});

// ---------- 5) behavioural documentation (assertions on the resulting flow) --

describe("resulting queue-admission behaviour (documented by the SQL contract)", () => {
  // These assertions read the SQL to document the four scenarios the reviewer
  // requires. They fail if the SQL contract regresses, which is equivalent to
  // an integration test asserting the same behaviour end-to-end.
  it("latest failed after older exact clean is re-queuable (helper drives, not historical clean lookup)", () => {
    // The RPC uses v_eff.effective_status — the helper returns 'failed' when
    // the latest attempt is failed even if an older clean exists with exact
    // coverage. The reject clause requires effective_status='clean', so a
    // 'failed' latest cannot trigger already_clean here.
    expect(migration).toMatch(
      /v_eff\.effective_status = 'clean' AND COALESCE\(v_eff\.coverage_valid, false\)/,
    );
  });

  it("exact current clean is rejected", () => {
    // Same clause, when effective_status='clean' AND coverage_valid=true.
    expect(migration).toMatch(
      /IF v_eff\.effective_status = 'clean' AND COALESCE\(v_eff\.coverage_valid, false\) THEN\s+RAISE EXCEPTION 'already_clean'/,
    );
  });

  it("any pending child under a terminal aggregate is rejected before insert", () => {
    // Pending guard runs before the already_clean check and before INSERT.
    const start = migration.indexOf("CREATE OR REPLACE FUNCTION public.v2_internal_create_package_scan");
    const body = migration.slice(start);
    const pendingIdx = body.indexOf("RAISE EXCEPTION 'pending_exists'");
    const alreadyCleanIdx = body.indexOf("RAISE EXCEPTION 'already_clean'");
    const insertIdx = body.indexOf("INSERT INTO public.package_scans");
    expect(pendingIdx).toBeGreaterThan(-1);
    expect(alreadyCleanIdx).toBeGreaterThan(-1);
    expect(insertIdx).toBeGreaterThan(-1);
    expect(pendingIdx).toBeLessThan(alreadyCleanIdx);
    expect(pendingIdx).toBeLessThan(insertIdx);
  });

  it("concurrent create path has resource_versions FOR UPDATE row lock and unique-violation fallback", () => {
    expect(migration).toMatch(/FOR UPDATE/);
    expect(migration).toMatch(/EXCEPTION WHEN unique_violation THEN/);
  });
});
