import { describe, expect, it } from "bun:test";
import {
  authorizeDownload,
  effectiveScanState,
  type ResourceFile,
  type Scan,
  type ScanItem,
} from "./effectiveScanState";
import { decideQueueAllowed } from "../../../../supabase/functions/_shared/scanProvider";

declare const require: (m: string) => any;
const { readFileSync } = require("fs");
const { resolve } = require("path");
const HERE: string = (import.meta as unknown as { dir?: string }).dir ?? ".";

const VERSION = "00000000-0000-0000-0000-00000000000v";
const OTHER_VERSION = "00000000-0000-0000-0000-00000000000w";
const F1 = "file-1";
const F2 = "file-2";
const F3 = "file-3";
const USER = "user-1";

function file(id: string, version = VERSION): ResourceFile {
  return { id, resource_version_id: version };
}
function scan(
  id: string,
  status: Scan["status"],
  createdAt: string,
  version = VERSION,
): Scan {
  return {
    id,
    resource_version_id: version,
    status,
    created_at: createdAt,
    scanned_at: createdAt,
    completed_at: createdAt,
  };
}
function item(
  id: string,
  scanId: string,
  fileId: string | null,
  status: ScanItem["status"],
): ScanItem {
  return {
    id,
    package_scan_id: scanId,
    resource_file_id: fileId,
    status,
  };
}

describe("v2 effective scan state — fail-closed contract", () => {
  it("exact clean coverage authorizes the requested owned file", () => {
    const files = [file(F1), file(F2)];
    const scans = [scan("s1", "clean", "2026-01-01")];
    const items = [
      item("i1", "s1", F1, "clean"),
      item("i2", "s1", F2, "clean"),
    ];
    const eff = effectiveScanState({ versionId: VERSION, files, scans, items });
    expect(eff.effective_status).toBe("clean");
    expect(eff.coverage_valid).toBe(true);
    expect(eff.current_file_count).toBe(2);
    expect(eff.scanned_file_count).toBe(2);
    expect(
      authorizeDownload({
        fileId: F1,
        versionId: VERSION,
        files,
        scans,
        items,
        entitled: true,
      }).allowed,
    ).toBe(true);
  });

  it("appending a file after a clean scan makes coverage stale and denies download", () => {
    const files = [file(F1), file(F2), file(F3)]; // F3 appended after scan
    const scans = [scan("s1", "clean", "2026-01-01")];
    const items = [
      item("i1", "s1", F1, "clean"),
      item("i2", "s1", F2, "clean"),
    ];
    const eff = effectiveScanState({ versionId: VERSION, files, scans, items });
    expect(eff.stored_status).toBe("clean");
    expect(eff.coverage_valid).toBe(false);
    expect(eff.effective_status).toBe("unscanned");
    for (const fid of [F1, F2, F3]) {
      expect(
        authorizeDownload({
          fileId: fid,
          versionId: VERSION,
          files,
          scans,
          items,
          entitled: true,
        }).reason,
      ).toBe("package_unavailable");
    }
  });

  it("removing a file after a clean scan makes coverage stale (extra scanned item)", () => {
    // Scan covered F1+F2, but F2 is gone. distinct scanned count (2) != current file count (1).
    const files = [file(F1)];
    const scans = [scan("s1", "clean", "2026-01-01")];
    const items = [
      item("i1", "s1", F1, "clean"),
      item("i2", "s1", F2, "clean"),
    ];
    const eff = effectiveScanState({ versionId: VERSION, files, scans, items });
    expect(eff.coverage_valid).toBe(false);
    expect(eff.effective_status).toBe("unscanned");
  });

  it("replacing a file after clean scan (different id, same version) denies", () => {
    const files = [file(F3)]; // F1 replaced with F3
    const scans = [scan("s1", "clean", "2026-01-01")];
    const items = [item("i1", "s1", F1, "clean")];
    const eff = effectiveScanState({ versionId: VERSION, files, scans, items });
    expect(eff.coverage_valid).toBe(false);
    expect(
      authorizeDownload({
        fileId: F3,
        versionId: VERSION,
        files,
        scans,
        items,
        entitled: true,
      }).allowed,
    ).toBe(false);
  });

  it("clean scan item pointing at a file from a different version does not confer coverage", () => {
    const files = [file(F1)];
    const scans = [scan("s1", "clean", "2026-01-01")];
    // Item references a file from another version — must not authorize
    const items = [item("i1", "s1", "other-file", "clean")];
    const eff = effectiveScanState({ versionId: VERSION, files, scans, items });
    expect(eff.coverage_valid).toBe(false);
    expect(
      authorizeDownload({
        fileId: F1,
        versionId: VERSION,
        files,
        scans,
        items,
        entitled: true,
      }).allowed,
    ).toBe(false);
  });

  it("duplicate scan items cannot inflate coverage counts", () => {
    // Two files, but scan has three items where F1 is duplicated.
    const files = [file(F1), file(F2)];
    const scans = [scan("s1", "clean", "2026-01-01")];
    const items = [
      item("i1", "s1", F1, "clean"),
      item("i2", "s1", F1, "clean"), // duplicate
      // F2 missing entirely
    ];
    const eff = effectiveScanState({ versionId: VERSION, files, scans, items });
    expect(eff.coverage_valid).toBe(false);
    expect(eff.effective_status).toBe("unscanned");
  });

  for (const status of ["pending", "suspicious", "malicious", "failed"] as const) {
    it(`latest scan status '${status}' is never effective clean and denies download`, () => {
      const files = [file(F1)];
      const scans = [scan("s1", status, "2026-01-01")];
      const items = [item("i1", "s1", F1, status === "pending" ? "pending" : status)];
      const eff = effectiveScanState({
        versionId: VERSION,
        files,
        scans,
        items,
      });
      expect(eff.effective_status).toBe(status);
      expect(eff.coverage_valid).toBe(false);
      expect(
        authorizeDownload({
          fileId: F1,
          versionId: VERSION,
          files,
          scans,
          items,
          entitled: true,
        }).allowed,
      ).toBe(false);
    });
  }

  it("no scans yet => unscanned and denies download", () => {
    const files = [file(F1)];
    const eff = effectiveScanState({
      versionId: VERSION,
      files,
      scans: [],
      items: [],
    });
    expect(eff.effective_status).toBe("unscanned");
    expect(
      authorizeDownload({
        fileId: F1,
        versionId: VERSION,
        files,
        scans: [],
        items: [],
        entitled: true,
      }).allowed,
    ).toBe(false);
  });

  it("no current files => never effective clean (even with historical clean scan)", () => {
    const scans = [scan("s1", "clean", "2026-01-01")];
    const items = [item("i1", "s1", F1, "clean")];
    const eff = effectiveScanState({
      versionId: VERSION,
      files: [],
      scans,
      items,
    });
    expect(eff.has_files).toBe(false);
    expect(eff.coverage_valid).toBe(false);
    expect(eff.effective_status).toBe("unscanned");
  });

  it("non-entitled user is denied before any scan check", () => {
    const files = [file(F1)];
    const scans = [scan("s1", "clean", "2026-01-01")];
    const items = [item("i1", "s1", F1, "clean")];
    expect(
      authorizeDownload({
        fileId: F1,
        versionId: VERSION,
        files,
        scans,
        items,
        entitled: false,
      }).reason,
    ).toBe("not_authorized");
  });

  it("public trust badge / admin queue / authorize all agree on effective state", () => {
    // Stale-clean: latest scan clean but F2 appended afterwards.
    const files = [file(F1), file(F2)];
    const scans = [scan("s1", "clean", "2026-01-01")];
    const items = [item("i1", "s1", F1, "clean")];
    const eff = effectiveScanState({ versionId: VERSION, files, scans, items });
    // trust badge derivation:
    const badge = {
      status: eff.effective_status,
      scanned_at: eff.effective_status === "clean" && eff.coverage_valid
        ? "2026-01-01"
        : null,
    };
    expect(badge.status).toBe("unscanned");
    expect(badge.scanned_at).toBeNull();
    // admin queue displayed status:
    expect(eff.effective_status).toBe("unscanned");
    // authorize decision:
    expect(
      authorizeDownload({
        fileId: F1,
        versionId: VERSION,
        files,
        scans,
        items,
        entitled: true,
      }).allowed,
    ).toBe(false);
  });
});

describe("decideQueueAllowed — stale-clean must be re-queuable", () => {
  const base = {
    hasAnyPendingChild: false,
    hasFiles: true,
    providerReady: true,
  } as const;

  it("blocks re-queue only when latest is clean AND coverage_valid=true", () => {
    expect(
      decideQueueAllowed({
        ...base,
        latestScanStatus: "clean",
        coverageValid: true,
      }),
    ).toEqual({ allow: false, reason: "already_clean" });
  });

  it("stale clean (coverage_valid=false) must proceed to fresh scan", () => {
    expect(
      decideQueueAllowed({
        ...base,
        latestScanStatus: "clean",
        coverageValid: false,
      }),
    ).toEqual({ allow: true });
  });

  it("suspicious / malicious / failed / unscanned all allow re-queue", () => {
    for (const s of ["suspicious", "malicious", "failed", null] as const) {
      expect(
        decideQueueAllowed({
          ...base,
          latestScanStatus: s,
          coverageValid: false,
        }),
      ).toEqual({ allow: true });
    }
  });

  it("pending latest and pending children still block", () => {
    expect(
      decideQueueAllowed({
        ...base,
        latestScanStatus: "pending",
        coverageValid: false,
      }),
    ).toEqual({ allow: false, reason: "pending_exists" });
    expect(
      decideQueueAllowed({
        ...base,
        hasAnyPendingChild: true,
        latestScanStatus: null,
        coverageValid: false,
      }),
    ).toEqual({ allow: false, reason: "pending_exists" });
  });

  it("no_files and not_ready still fail closed", () => {
    expect(
      decideQueueAllowed({
        ...base,
        hasFiles: false,
        latestScanStatus: null,
      }),
    ).toEqual({ allow: false, reason: "no_files" });
    expect(
      decideQueueAllowed({
        ...base,
        providerReady: false,
        latestScanStatus: null,
      }),
    ).toEqual({ allow: false, reason: "not_ready" });
  });
});

// -----------------------------------------------------------------------------
// Static SQL contract test — asserts the draft migration establishes the
// invariants the runtime tests model. Draft path is source-only; the migration
// has not been applied.
// -----------------------------------------------------------------------------
describe("draft migration — fail-closed SQL contract", () => {
  const path = resolve(
    HERE,
    "../../../../docs/security/drafts/20260728130000_package_scan_fail_closed_effective_state.sql",
  );
  const sql = readFileSync(path, "utf8");

  it("defines v2_internal_effective_scan_state and revokes public execute", () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.v2_internal_effective_scan_state\s*\(/,
    );
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.v2_internal_effective_scan_state\(uuid\)\s+FROM PUBLIC,\s*anon,\s*authenticated/,
    );
    expect(sql).toMatch(
      /GRANT\s+EXECUTE ON FUNCTION public\.v2_internal_effective_scan_state\(uuid\)\s+TO service_role/,
    );
  });

  it("both authorize_resource_download overloads call the effective-state helper and require file-in-clean-items", () => {
    // both overloads present
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.authorize_resource_download\(p_file_id uuid, p_user_id uuid\)/,
    );
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.authorize_resource_download\(p_file_id uuid\)/,
    );
    // both must consult the effective-state helper
    const calls = sql.match(/v2_internal_effective_scan_state\s*\(\s*v_ver\s*\)/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(2);
    // both must gate on coverage_valid AND effective_status='clean'
    const gates = sql.match(
      /effective_status <> 'clean' OR NOT v_eff\.coverage_valid/g,
    ) ?? [];
    expect(gates.length).toBeGreaterThanOrEqual(2);
    // both must require the requested file to be a clean item in that scan
    const cleanFileGates = sql.match(
      /psi\.package_scan_id = v_eff\.latest_scan_id\s+AND psi\.resource_file_id = p_file_id\s+AND psi\.status = 'clean'/g,
    ) ?? [];
    expect(cleanFileGates.length).toBeGreaterThanOrEqual(2);
  });

  it("public trust badges and admin queue derive from the same helper", () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.get_public_resource_trust_badges/,
    );
    expect(sql).toMatch(/eff\.effective_status\s+AS scan_status/);
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.v2_admin_list_package_scan_queue/,
    );
    expect(sql).toMatch(/eff\.effective_status\s+AS latest_scan_status/);
    expect(sql).toMatch(/eff\.coverage_valid/);
  });

  it("v2_admin_get_resource_version_detail exposes effective_scan from the same helper (list/detail/control agreement)", () => {
    // Detail RPC must call v2_internal_effective_scan_state and emit an
    // effective_scan object with coverage_valid + effective_status so the
    // frontend ScanDetailSheet can drive the Queue guard from the same
    // authoritative signal used by authorization, badges, and admin queue.
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.v2_admin_get_resource_version_detail\(\s*p_version_id uuid/,
    );
    expect(sql).toMatch(/public\.v2_internal_effective_scan_state\(p_version_id\)/);
    // JSON keys required for the AdminResourceVersionEffectiveScan contract.
    for (const key of [
      "'has_files'",
      "'latest_scan_id'",
      "'stored_status'",
      "'effective_status'",
      "'coverage_valid'",
      "'current_file_count'",
      "'scanned_file_count'",
      "'latest_created_at'",
      "'latest_scanned_at'",
    ]) {
      expect(sql).toContain(key);
    }
    // Result envelope must include the effective_scan key alongside version/files/scans.
    expect(sql).toMatch(/'effective_scan',\s*v_effective_scan/);
    // ACL from migration 20260724165802 must be preserved (authenticated-only).
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.v2_admin_get_resource_version_detail\(uuid\)\s+FROM PUBLIC,\s*anon,\s*service_role/,
    );
    expect(sql).toMatch(
      /GRANT\s+EXECUTE ON FUNCTION public\.v2_admin_get_resource_version_detail\(uuid\)\s+TO authenticated/,
    );
  });

  it("published-version file immutability trigger uses stable error and covers INSERT/UPDATE/DELETE", () => {
    expect(sql).toMatch(
      /RAISE EXCEPTION 'published_version_immutable' USING ERRCODE = '42501'/,
    );
    expect(sql).toMatch(
      /BEFORE INSERT OR UPDATE OR DELETE ON public\.resource_files/,
    );
    // Trigger function must be service_role only
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.v2_enforce_published_file_immutability\(\)\s+FROM PUBLIC,\s*anon,\s*authenticated/,
    );
    // UPDATE branch MUST consult BOTH OLD.resource_version_id and
    // NEW.resource_version_id so a row cannot be moved into or out of a
    // published version.
    expect(sql).toMatch(/id = OLD\.resource_version_id/);
    expect(sql).toMatch(/id = NEW\.resource_version_id/);
    expect(sql).toMatch(/TG_OP IN \('UPDATE', 'DELETE'\)/);
    expect(sql).toMatch(/TG_OP IN \('INSERT', 'UPDATE'\)/);
  });

  it("preserves authoritative ACL: one-arg authorize_resource_download is service_role only (not executable by authenticated)", () => {
    // Regression: migration 20260723122822 revoked the one-arg overload from
    // PUBLIC/anon/authenticated. The frontend must call the resource-download
    // Edge Function and must never receive a private storage locator. Preserve
    // that ACL — this migration must NOT re-grant to authenticated.
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.authorize_resource_download\(uuid\)\s+FROM PUBLIC,\s*anon,\s*authenticated/,
    );
    expect(sql).toMatch(
      /GRANT\s+EXECUTE ON FUNCTION public\.authorize_resource_download\(uuid\)\s+TO service_role/,
    );
    const bad = sql.match(
      /GRANT[^;]*authorize_resource_download\(uuid\)[^;]*(anon|authenticated|PUBLIC)/gi,
    ) ?? [];
    expect(bad).toEqual([]);
    // Two-arg service-only overload must also remain service_role only.
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.authorize_resource_download\(uuid,\s*uuid\)\s+FROM PUBLIC,\s*anon,\s*authenticated/,
    );
    expect(sql).toMatch(
      /GRANT\s+EXECUTE ON FUNCTION public\.authorize_resource_download\(uuid,\s*uuid\)\s+TO service_role/,
    );
  });

  it("does not weaken execute grants on internal helper for anon/authenticated", () => {
    // Verify no accidental grant to anon or authenticated for the internal helper
    const bad = sql.match(
      /GRANT[^;]*v2_internal_effective_scan_state[^;]*(anon|authenticated)/gi,
    ) ?? [];
    expect(bad).toEqual([]);
  });
});

// Reference to silence unused imports when tree-shaken.
void OTHER_VERSION;
void USER;
