import { describe, expect, it } from "bun:test";
import {
  formatDownloadsTile,
  formatDeliveryFailuresTile,
} from "./overviewKpiFormat";

describe("formatDownloadsTile", () => {
  it("renders numeric value and unique-users hint when available", () => {
    const t = formatDownloadsTile(
      { available: true, count: 1234, unique_users: 56 },
      30,
    );
    expect(t.value).toBe("1,234");
    expect(t.hint).toBe("56 unique users");
    expect(t.unavailable).toBeUndefined();
    expect(t.label).toBe("Downloads · 30d");
  });

  it("renders 0 (not Unavailable) when count is zero", () => {
    const t = formatDownloadsTile(
      { available: true, count: 0, unique_users: 0 },
      30,
    );
    expect(t.value).toBe("0");
    expect(t.unavailable).toBeUndefined();
  });

  it("fails closed when available is false", () => {
    const t = formatDownloadsTile(
      { available: false, reason: "download event stream unavailable" },
      30,
    );
    expect(t.value).toBe("Unavailable");
    expect(t.unavailable).toBe("download event stream unavailable");
  });

  it("fails closed on malformed / missing fields", () => {
    expect(formatDownloadsTile(null, 30).unavailable).not.toBeUndefined();
    expect(formatDownloadsTile({ available: true }, 30).unavailable).toBe(
      "invalid response",
    );
    expect(
      formatDownloadsTile({ available: true, count: -1 }, 30).unavailable,
    ).toBe("invalid response");
    expect(
      formatDownloadsTile({ available: true, count: "5" as any }, 30)
        .unavailable,
    ).toBe("invalid response");
  });
});

describe("formatDeliveryFailuresTile", () => {
  it("renders numeric value and attempts hint when available", () => {
    const t = formatDeliveryFailuresTile(
      { available: true, count: 3, attempts: 120 },
      30,
    );
    expect(t.value).toBe("3");
    expect(t.hint).toBe("3 failed / 120 attempts");
    expect(t.unavailable).toBeUndefined();
    expect(t.label).toBe("Delivery failures · 30d");
  });

  it("renders 0 (not Unavailable) when no failures in period", () => {
    const t = formatDeliveryFailuresTile(
      { available: true, count: 0, attempts: 42 },
      30,
    );
    expect(t.value).toBe("0");
    expect(t.hint).toBe("0 failed / 42 attempts");
    expect(t.unavailable).toBeUndefined();
  });

  it("fails closed when available is false", () => {
    const t = formatDeliveryFailuresTile(
      { available: false, reason: "email delivery events unavailable" },
      30,
    );
    expect(t.value).toBe("Unavailable");
    expect(t.unavailable).toBe("email delivery events unavailable");
  });

  it("fails closed on malformed shapes", () => {
    expect(formatDeliveryFailuresTile(undefined, 30).unavailable).not.toBeUndefined();
    expect(
      formatDeliveryFailuresTile({ available: true }, 30).unavailable,
    ).toBe("invalid response");
    expect(
      formatDeliveryFailuresTile({ available: true, count: 1.5 }, 30)
        .unavailable,
    ).toBe("invalid response");
  });
});
