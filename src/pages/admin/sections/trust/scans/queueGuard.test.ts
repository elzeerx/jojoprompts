import { describe, it, expect } from "bun:test";
import { evaluateQueueGuard } from "./queueGuard";

const base = {
  providerReady: true,
  hasFiles: true,
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

  it("blocks clean/suspicious/malicious latest with already_clean", () => {
    for (const s of ["clean", "suspicious", "malicious"] as const) {
      const r = evaluateQueueGuard({ ...base, latestScanStatus: s });
      expect(r).toEqual({ canQueue: false, reason: "already_clean" });
    }
  });

  it("blocks pending latest with pending_exists", () => {
    const r = evaluateQueueGuard({ ...base, latestScanStatus: "pending" });
    expect(r).toEqual({ canQueue: false, reason: "pending_exists" });
  });

  it("blocks when an aggregate pending scan exists", () => {
    const r = evaluateQueueGuard({ ...base, hasPendingAggregate: true });
    expect(r).toEqual({ canQueue: false, reason: "pending_exists" });
  });

  it("blocks when a pending child exists under a terminal aggregate", () => {
    for (const s of ["failed", "malicious", "suspicious"] as const) {
      const r = evaluateQueueGuard({
        ...base,
        latestScanStatus: s,
        // suspicious/malicious will already block earlier via already_clean,
        // but we still verify pending-child blocks for `failed` explicitly.
        hasPendingChild: true,
      });
      if (s === "failed") {
        expect(r).toEqual({ canQueue: false, reason: "pending_exists" });
      } else {
        expect(r).toEqual({ canQueue: false, reason: "already_clean" });
      }
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
