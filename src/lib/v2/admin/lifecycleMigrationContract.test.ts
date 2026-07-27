/**
 * Migration contract test for the corrective lifecycle hardening
 * (supabase/migrations/20260727073236_*.sql).
 *
 * LIMITATION: This project has no live/local Postgres test harness that runs
 * inside `bun test`. This test therefore reads the applied migration SQL and
 * asserts the presence of the authoritative guards + audit contract required
 * by Phase 2 exit. It is NOT an end-to-end DB proof; a live-DB test would
 * run in Supabase's SQL editor or a pgtap fixture.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const MIGRATIONS_DIR = "supabase/migrations";
const CORRECTIVE_PREFIX = "20260727073236";

function loadCorrectiveSql(): string {
  const file = readdirSync(MIGRATIONS_DIR).find((f) => f.startsWith(CORRECTIVE_PREFIX));
  if (!file) throw new Error(`Corrective migration ${CORRECTIVE_PREFIX}_*.sql not found`);
  return readFileSync(join(MIGRATIONS_DIR, file), "utf8");
}

describe("corrective lifecycle migration contract", () => {
  const sql = loadCorrectiveSql();

  it("replaces admin_transition_resource_lifecycle and admin_publish_resource", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.admin_transition_resource_lifecycle/);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.admin_publish_resource/);
  });

  it("enforces the authoritative state matrix in transition", () => {
    // review from draft only
    expect(sql).toMatch(/p_action = 'review'\s+AND v_prev_lifecycle = 'draft'/);
    // archive from draft, review, or published (not archived)
    expect(sql).toMatch(/p_action = 'archive'\s+AND v_prev_lifecycle IN \('draft','review','published'\)/);
    // restore only from archived
    expect(sql).toMatch(/p_action = 'restore'\s+AND v_prev_lifecycle = 'archived'/);
  });

  it("returns invalid_transition without update or audit for disallowed action", () => {
    // invalid_transition contract present with previous_lifecycle + attempted_action
    expect(sql).toMatch(/'error',\s*'invalid_transition'/);
    expect(sql).toMatch(/'attempted_action',\s*p_action/);
    // The invalid_transition branch RETURNs before any UPDATE or INSERT INTO activity_events.
    const transitionFn = sql.split(/CREATE OR REPLACE FUNCTION public\.admin_publish_resource/)[0];
    const invalidIdx = transitionFn.indexOf("'invalid_transition'");
    const updateIdx = transitionFn.indexOf("UPDATE public.resources");
    const insertIdx = transitionFn.indexOf("INSERT INTO public.activity_events");
    expect(invalidIdx).toBeGreaterThan(0);
    expect(invalidIdx).toBeLessThan(updateIdx);
    expect(invalidIdx).toBeLessThan(insertIdx);
  });

  it("restore action maps to draft (safe restore contract)", () => {
    expect(sql).toMatch(/WHEN 'restore' THEN v_new_lifecycle := 'draft'/);
  });

  it("publish rejects non-draft/review lifecycles", () => {
    expect(sql).toMatch(/v_prev_lifecycle NOT IN \('draft','review'\)/);
    // Published stays as idempotent no-op (no invalid_transition, no audit).
    expect(sql).toMatch(/IF v_prev_lifecycle = 'published' THEN[\s\S]*?'no_change', true/);
  });

  it("publish adds bundle_self_inclusion and bundle_duplicate_item guards", () => {
    expect(sql).toContain("bundle_self_inclusion");
    expect(sql).toContain("bundle_duplicate_item");
    // Self-inclusion check joins pbi with products where p.resource_id = target and pbi.resource_id = target.
    expect(sql).toMatch(/pbi\.resource_id = p_resource_id/);
    // Duplicate check groups pbi.resource_id and looks for count > 1.
    expect(sql).toMatch(/GROUP BY pbi\.resource_id\s+HAVING count\(\*\) > 1/);
  });

  it("audit event on transition carries previous_lifecycle, resulting_lifecycle, version_id", () => {
    expect(sql).toMatch(/'previous_lifecycle',\s*v_prev_lifecycle/);
    expect(sql).toMatch(/'resulting_lifecycle',\s*v_new_lifecycle/);
    expect(sql).toMatch(/'version_id',\s*v_current_version_id/);
  });

  it("idempotent same-state transitions return no_change without audit insert", () => {
    // The no_change branch must RETURN before any INSERT INTO activity_events in the transition fn.
    const transitionFn = sql.split(/CREATE OR REPLACE FUNCTION public\.admin_publish_resource/)[0];
    const noChangeIdx = transitionFn.indexOf("'no_change'");
    const insertIdx = transitionFn.indexOf("INSERT INTO public.activity_events");
    expect(noChangeIdx).toBeGreaterThan(0);
    expect(noChangeIdx).toBeLessThan(insertIdx);
  });
});
