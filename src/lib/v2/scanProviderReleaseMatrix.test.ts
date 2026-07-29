import { describe, expect, it } from "bun:test";
import {
  aggregateItemStatuses,
  classifyHttpStatus,
  decideQueueAllowed,
  decideReadinessPersistence,
  evaluateReadiness,
  MAX_ITEM_ATTEMPTS,
  mapAdvancedScanBody,
  shouldStopForAttempts,
} from "../../../supabase/functions/_shared/scanProvider";

describe("Cloudmersive release matrix", () => {
  it("accepts a clean provider result without weakening code-package policy", () => {
    const result = mapAdvancedScanBody({
      CleanResult: true,
      ContainsScript: true,
      ContainsExecutable: true,
      VerifiedFileFormat: "zip",
    });

    expect(result.status).toBe("clean");
    expect(result.transient).toBe(false);
    expect(result.summary.contains_script).toBe(true);
    expect(result.summary.contains_executable).toBe(true);
  });

  it("maps malware and contradictory clean signals to malicious", () => {
    for (const cleanResult of [false, true]) {
      const result = mapAdvancedScanBody({
        CleanResult: cleanResult,
        FoundViruses: [{ VirusName: "Eicar-Test-Signature" }],
      });

      expect(result.status).toBe("malicious");
      expect(result.reason).toBe("virus_found");
    }
  });

  it("fails closed for blocked risks and malformed successful responses", () => {
    expect(
      mapAdvancedScanBody({
        CleanResult: false,
        ContainsMacros: true,
      }).status,
    ).toBe("suspicious");

    for (const body of [null, {}, { CleanResult: "yes" }]) {
      const result = mapAdvancedScanBody(body);
      expect(result.status).toBe("failed");
      expect(result.reason).toBe("malformed_response");
    }
  });

  it("classifies unavailable provider responses as retryable but auth and size errors as terminal", () => {
    for (const status of [0, 408, 429, 500, 502, 503, 504]) {
      expect(classifyHttpStatus(status)).toEqual({
        kind: "transient",
        reason: "provider_transient",
      });
    }

    expect(classifyHttpStatus(401)).toEqual({
      kind: "terminal",
      reason: "provider_unauthorized",
    });
    expect(classifyHttpStatus(413)).toEqual({
      kind: "terminal",
      reason: "provider_file_too_large",
    });
  });

  it("fails immediately when scanner secrets are missing", () => {
    const noApiKey = evaluateReadiness({
      hasApiKey: false,
      hasWorkerSecret: true,
    });
    const noWorkerSecret = evaluateReadiness({
      hasApiKey: true,
      hasWorkerSecret: false,
    });

    expect(noApiKey.ready).toBe(false);
    expect(noWorkerSecret.ready).toBe(false);
    expect(decideReadinessPersistence(noApiKey.reason)).toBe("fail_now");
    expect(decideReadinessPersistence(noWorkerSecret.reason)).toBe("fail_now");
  });

  it("blocks clean publication when any file is pending, failed, suspicious, or malicious", () => {
    expect(aggregateItemStatuses(["clean", "pending"])).toBe("pending");
    expect(aggregateItemStatuses(["clean", "failed"])).toBe("failed");
    expect(aggregateItemStatuses(["clean", "suspicious"])).toBe("suspicious");
    expect(aggregateItemStatuses(["clean", "malicious"])).toBe("malicious");
  });

  it("bounds unavailable-provider retries and does not accept stale clean coverage", () => {
    expect(shouldStopForAttempts(MAX_ITEM_ATTEMPTS - 1)).toBe(false);
    expect(shouldStopForAttempts(MAX_ITEM_ATTEMPTS)).toBe(true);

    expect(
      decideQueueAllowed({
        latestScanStatus: "clean",
        hasAnyPendingChild: false,
        hasFiles: true,
        providerReady: true,
        coverageValid: false,
      }),
    ).toEqual({ allow: true });
  });
});
