import { describe, it, expect } from "bun:test";
import {
  extractLeadingUuid,
  resolveCallbackOrderId,
  buildCleanCallbackUrls,
} from "./callbackOrderId";

const UUID = "766f3370-d38c-42e5-8566-5e4946986dd2";

describe("buildCleanCallbackUrls", () => {
  it("builds query-free path-parameter callback URLs", () => {
    const { returnUrl, cancelUrl } = buildCleanCallbackUrls(
      "https://jojoprompts.com",
      UUID,
    );
    expect(returnUrl).toBe(`https://jojoprompts.com/checkout/return/${UUID}`);
    expect(cancelUrl).toBe(`https://jojoprompts.com/checkout/cancel/${UUID}`);
    // No `?` in either URL — provider can safely append its own query.
    expect(returnUrl.includes("?")).toBe(false);
    expect(cancelUrl.includes("?")).toBe(false);
  });
});

describe("extractLeadingUuid", () => {
  it("accepts a clean UUID", () => {
    expect(extractLeadingUuid(UUID)).toBe(UUID);
  });

  it("recovers a leading UUID from the historical malformed double-? form", () => {
    expect(extractLeadingUuid(`${UUID}?payment_id=abc&result=CAPTURED`)).toBe(UUID);
    expect(extractLeadingUuid(`${UUID}&payment_id=abc`)).toBe(UUID);
  });

  it("rejects non-UUID input", () => {
    expect(extractLeadingUuid("not-a-uuid")).toBeNull();
    expect(extractLeadingUuid("")).toBeNull();
    expect(extractLeadingUuid(null)).toBeNull();
    expect(extractLeadingUuid(undefined)).toBeNull();
    expect(extractLeadingUuid(`x${UUID}`)).toBeNull();
    expect(extractLeadingUuid(`${UUID}extra`)).toBeNull();
  });
});

describe("resolveCallbackOrderId", () => {
  it("prefers a valid path parameter", () => {
    expect(resolveCallbackOrderId(UUID, "other-value")).toBe(UUID);
  });

  it("falls back to the legacy query parameter", () => {
    expect(resolveCallbackOrderId(null, UUID)).toBe(UUID);
    expect(resolveCallbackOrderId(undefined, UUID)).toBe(UUID);
  });

  it("recovers from the malformed legacy double-? query form", () => {
    expect(
      resolveCallbackOrderId(null, `${UUID}?payment_id=abc&result=CAPTURED`),
    ).toBe(UUID);
  });

  it("rejects invalid ids", () => {
    expect(resolveCallbackOrderId(null, null)).toBeNull();
    expect(resolveCallbackOrderId("bad", "also-bad")).toBeNull();
  });

  it("provider query parameters cannot override a valid path id", () => {
    // Even if a hostile query parameter carries a different UUID, path wins.
    const other = "11111111-1111-1111-1111-111111111111";
    expect(resolveCallbackOrderId(UUID, other)).toBe(UUID);
  });
});
