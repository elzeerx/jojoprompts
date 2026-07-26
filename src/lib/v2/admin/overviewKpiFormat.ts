// Pure formatters for the two Overview KPIs (Downloads, Delivery failures)
// wired in Phase 6E11. Fail closed: any unexpected shape returns an
// "Unavailable" tile with a reason string.

export interface KpiTile {
  label: string;
  value: string;
  hint?: string;
  unavailable?: string;
}

interface DownloadsField {
  available: boolean;
  count?: number;
  unique_users?: number;
  reason?: string;
}

interface DeliveryFailuresField {
  available: boolean;
  count?: number;
  attempts?: number;
  reason?: string;
}

const LABEL_DOWNLOADS = "Downloads";
const LABEL_DELIVERY = "Delivery failures";

function isFiniteNonNeg(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && Number.isInteger(n);
}

function fmt(n: number): string {
  return n.toLocaleString();
}

export function formatDownloadsTile(
  raw: unknown,
  periodDays: number,
): KpiTile {
  const label = `${LABEL_DOWNLOADS} · ${periodDays}d`;
  if (!raw || typeof raw !== "object") {
    return { label, value: "Unavailable", unavailable: "not wired" };
  }
  const d = raw as DownloadsField;
  if (d.available !== true) {
    return {
      label,
      value: "Unavailable",
      unavailable: typeof d.reason === "string" && d.reason ? d.reason : "not wired",
    };
  }
  if (!isFiniteNonNeg(d.count)) {
    return { label, value: "Unavailable", unavailable: "invalid response" };
  }
  const unique = isFiniteNonNeg(d.unique_users) ? d.unique_users : null;
  return {
    label,
    value: fmt(d.count),
    hint: unique == null ? undefined : `${fmt(unique)} unique users`,
  };
}

export function formatDeliveryFailuresTile(
  raw: unknown,
  periodDays: number,
): KpiTile {
  const label = `${LABEL_DELIVERY} · ${periodDays}d`;
  if (!raw || typeof raw !== "object") {
    return { label, value: "Unavailable", unavailable: "not wired" };
  }
  const d = raw as DeliveryFailuresField;
  if (d.available !== true) {
    return {
      label,
      value: "Unavailable",
      unavailable: typeof d.reason === "string" && d.reason ? d.reason : "not wired",
    };
  }
  if (!isFiniteNonNeg(d.count)) {
    return { label, value: "Unavailable", unavailable: "invalid response" };
  }
  const attempts = isFiniteNonNeg(d.attempts) ? d.attempts : null;
  return {
    label,
    value: fmt(d.count),
    hint:
      attempts == null
        ? undefined
        : `${fmt(d.count)} failed / ${fmt(attempts)} attempts`,
  };
}
