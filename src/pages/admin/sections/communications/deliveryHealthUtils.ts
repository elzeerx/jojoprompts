/**
 * Delivery Health — pure helpers.
 *
 * Kept small and dependency-free so they can be unit-tested without React,
 * a network stack, or Supabase.
 */

export interface DeliveryLog {
  id: string;
  email_address: string;
  email_type: string;
  domain_type: string;
  delivery_status: string;
  bounce_reason: string | null;
  retry_count: number;
  attempted_at: string;
  success: boolean;
}

export interface DeliveryMetrics {
  attempted: number;
  delivered: number;
  failed: number;
  pending: number;
  bounced: number;
  retried: number;
  successRate: number; // 0-100
  bounceRate: number; // 0-100
  retryRate: number; // 0-100
}

export interface DomainStat {
  domain_type: string;
  total: number;
  successful: number;
  failed: number;
  success_rate: number;
}

export type Period = "1h" | "24h" | "7d" | "30d";

export function periodToHours(period: Period): number {
  switch (period) {
    case "1h":
      return 1;
    case "24h":
      return 24;
    case "7d":
      return 24 * 7;
    case "30d":
      return 24 * 30;
    default:
      return 24;
  }
}

export function computeDeliveryMetrics(logs: DeliveryLog[]): DeliveryMetrics {
  const attempted = logs.length;
  let delivered = 0;
  let failed = 0;
  let pending = 0;
  let bounced = 0;
  let retried = 0;

  // Mutually exclusive delivered / failed / pending buckets.
  for (const l of logs) {
    if (l.delivery_status === "pending") {
      pending += 1;
    } else if (l.success) {
      delivered += 1;
    } else {
      failed += 1;
    }
    if (l.bounce_reason) bounced += 1;
    if (l.retry_count > 0) retried += 1;
  }

  const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);
  return {
    attempted,
    delivered,
    failed,
    pending,
    bounced,
    retried,
    successRate: pct(delivered, attempted),
    bounceRate: pct(bounced, attempted),
    retryRate: pct(retried, attempted),
  };
}

export function computeDomainStats(logs: DeliveryLog[]): DomainStat[] {
  const map = new Map<
    string,
    { total: number; successful: number; failed: number }
  >();
  for (const l of logs) {
    const key = l.domain_type || "unknown";
    const s = map.get(key) ?? { total: 0, successful: 0, failed: 0 };
    s.total += 1;
    if (l.success) s.successful += 1;
    else if (l.delivery_status !== "pending") s.failed += 1;
    map.set(key, s);
  }
  return Array.from(map.entries())
    .map(([domain_type, s]) => ({
      domain_type,
      total: s.total,
      successful: s.successful,
      failed: s.failed,
      success_rate: s.total > 0 ? (s.successful / s.total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}
