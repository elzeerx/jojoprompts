import { describe, it, expect } from "bun:test";
import { evaluateQueueGuard } from "./queueGuard";

const base = {
  providerReady: true,
  hasFiles: true,
  effectiveStateKnown: true,
  latestScanStatus: null,
  hasPendingAggregate: false,
  hasPendingChild: false,
  pendingChildProbeLoading: false,
} as const;


describe("evaluateQueueGuard", () => {
  it("allows queueing when unscanned and every signal is ready", () => {
    expect(evaluateQueueGuard({ ...base })).toEqual({
      canQueue: true,
      reason: "ok",
    });
  });

  it("allows queueing on a failed latest scan", () => {
    expect(
      evaluateQueueGuard({ ...base, latestScanStatus: "failed" }),
    ).toEqual({ canQueue: true, reason: "ok" });
  });

  it("blocks when provider is not ready", () => {
    const r = evaluateQueueGuard({ ...base, providerReady: false });
    expect(r).toEqual({ canQueue: false, reason: "not_ready" });
  });

  it("blocks when there are no files even when ready", () => {
    const r = evaluateQueueGuard({ ...base, hasFiles: false });
    expect(r).toEqual({ canQueue: false, reason: "no_files" });
  });

  it("blocks only exact-coverage clean latest with already_clean", () => {
    const r = evaluateQueueGuard({
      ...base,
      latestScanStatus: "clean",
      coverageValid: true,
    });
    expect(r).toEqual({ canQueue: false, reason: "already_clean" });
  });

  it("allows queueing on stale clean (coverage invalid) and non-clean terminals", () => {
    expect(
      evaluateQueueGuard({
        ...base,
        latestScanStatus: "clean",
        coverageValid: false,
      }),
    ).toEqual({ canQueue: true, reason: "ok" });
    for (const s of ["suspicious", "malicious", "failed"] as const) {
      expect(
        evaluateQueueGuard({ ...base, latestScanStatus: s }),
      ).toEqual({ canQueue: true, reason: "ok" });
    }
  });

  it("fails closed when effective_scan is missing (real caller path: raw clean scans present but detail.effective_scan == null)", () => {
    // Reproduces the exact real ScanDetailSheet path: RPC returns files + raw
    // package_scans containing a clean row, but detail.effective_scan is null
    // (older payload or loading). effectiveStateKnown=false MUST fail closed
    // BEFORE the guard interprets latestScanStatus — the caller now passes
    // latestScanStatus=null in this case, so the previous test that spoofed
    // raw "clean" did not represent the real path.
    const r = evaluateQueueGuard({
      ...base,
      effectiveStateKnown: false,
      latestScanStatus: null,
    });
    expect(r).toEqual({ canQueue: false, reason: "checking" });
  });

  it("known effective unscanned enables Queue when all other signals are ready", () => {
    // Real unscanned is expressed as effectiveStateKnown=true with
    // latestScanStatus null/"unscanned" — the ONLY way to admit Queue.
    for (const s of [null, "unscanned"] as const) {
      const r = evaluateQueueGuard({
        ...base,
        effectiveStateKnown: true,
        latestScanStatus: s as null,
      });
      expect(r).toEqual({ canQueue: true, reason: "ok" });
    }
  });

  it("list / detail / control agree: same coverage_valid drives every path", () => {
    // Exact-coverage clean => queueGuard blocks with already_clean, mirroring
    // decideQueueAllowed on the server (already asserted in scanProvider_test).
    expect(
      evaluateQueueGuard({
        ...base,
        latestScanStatus: "clean",
        coverageValid: true,
      }).reason,
    ).toBe("already_clean");
    // Stale clean => queueGuard allows, mirroring decideQueueAllowed which
    // returns allow=true when coverageValid=false.
    expect(
      evaluateQueueGuard({
        ...base,
        latestScanStatus: "clean",
        coverageValid: false,
      }).canQueue,
    ).toBe(true);
  });



  it("blocks pending latest with pending_exists", () => {
    const r = evaluateQueueGuard({ ...base, latestScanStatus: "pending" });
    expect(r).toEqual({ canQueue: false, reason: "pending_exists" });
  });

  it("blocks when an aggregate pending scan exists", () => {
    const r = evaluateQueueGuard({ ...base, hasPendingAggregate: true });
    expect(r).toEqual({ canQueue: false, reason: "pending_exists" });
  });

  it("blocks when a pending child exists under any terminal aggregate", () => {
    for (const s of ["failed", "malicious", "suspicious"] as const) {
      const r = evaluateQueueGuard({
        ...base,
        latestScanStatus: s,
        hasPendingChild: true,
      });
      expect(r).toEqual({ canQueue: false, reason: "pending_exists" });
    }
  });

  it("fails closed while the pending-child probe is loading", () => {
    const r = evaluateQueueGuard({
      ...base,
      latestScanStatus: "failed",
      pendingChildProbeLoading: true,
    });
    expect(r).toEqual({ canQueue: false, reason: "checking" });
  });

  it("fails closed while probing even when hasPendingChild is false", () => {
    const r = evaluateQueueGuard({
      ...base,
      pendingChildProbeLoading: true,
    });
    expect(r).toEqual({ canQueue: false, reason: "checking" });
  });
});
