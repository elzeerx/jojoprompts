import { describe, expect, it } from "bun:test";
import { readFileSync, existsSync, readdirSync } from "node:fs";

/**
 * Regression guard for the legacy commerce write-hardening finding.
 *
 * The reviewed forward-only SQL is already applied live. It is kept in source
 * as migration history documentation. If the platform migration directory ever
 * receives the canonical file, this test picks it up from there instead.
 */
const CANONICAL_NAME =
  "20260801165606_harden_legacy_transaction_and_discount_writes.sql";
const MIGRATION_PATH = `supabase/migrations/${CANONICAL_NAME}`;
const DRAFT_PATH = `docs/security/drafts/${CANONICAL_NAME}`;

function readHardeningSql(): string {
  const path = existsSync(MIGRATION_PATH) ? MIGRATION_PATH : DRAFT_PATH;
  return readFileSync(path, "utf8");
}

const sql = readHardeningSql();
const normalized = sql.replace(/\s+/g, " ").toLowerCase();

describe("legacy commerce write hardening SQL", () => {
  it("is recorded in source exactly once", () => {
    const inMigrations = existsSync(MIGRATION_PATH);
    const inDrafts = existsSync(DRAFT_PATH);
    expect(inMigrations || inDrafts).toBe(true);
  });

  it("enables RLS on both legacy commerce tables", () => {
    expect(
      normalized.includes("alter table public.transactions enable row level security"),
    ).toBe(true);
    expect(
      normalized.includes(
        "alter table public.discount_code_usage enable row level security",
      ),
    ).toBe(true);
  });

  it("drops the two permissive browser-write policies", () => {
    expect(
      normalized.includes(
        'drop policy if exists "users can create their own transactions" on public.transactions',
      ),
    ).toBe(true);
    expect(
      normalized.includes(
        'drop policy if exists "system can insert discount code usage" on public.discount_code_usage',
      ),
    ).toBe(true);
  });

  it("revokes all table privileges from public, anon and authenticated", () => {
    for (const table of ["public.transactions", "public.discount_code_usage"]) {
      for (const role of ["public", "anon", "authenticated"]) {
        expect(
          normalized.includes(`revoke all on table ${table} from ${role}`),
        ).toBe(true);
      }
    }
  });

  it("leaves authenticated read-only and never re-grants writes", () => {
    expect(
      normalized.includes("grant select on table public.transactions to authenticated"),
    ).toBe(true);
    expect(
      normalized.includes(
        "grant select on table public.discount_code_usage to authenticated",
      ),
    ).toBe(true);
    for (const verb of ["insert", "update", "delete"]) {
      expect(normalized.includes(`grant ${verb}`)).toBe(false);
    }
    expect(normalized.includes("to anon")).toBe(false);
  });

  it("keeps service_role fully authoritative", () => {
    expect(
      normalized.includes("grant all on table public.transactions to service_role"),
    ).toBe(true);
    expect(
      normalized.includes(
        "grant all on table public.discount_code_usage to service_role",
      ),
    ).toBe(true);
  });

  it("makes record_discount_usage server-only", () => {
    const fn = "public.record_discount_usage(uuid, uuid, uuid)";
    for (const role of ["public", "anon", "authenticated"]) {
      expect(
        normalized.includes(`revoke execute on function ${fn} from ${role}`),
      ).toBe(true);
    }
    expect(
      normalized.includes(`grant execute on function ${fn} to service_role`),
    ).toBe(true);
  });

  it("contains no customer data mutation", () => {
    for (const verb of ["insert into", "update public.", "delete from"]) {
      expect(normalized.includes(verb)).toBe(false);
    }
  });
});

describe("browser services never write legacy commerce records", () => {
  const paymentService = readFileSync(
    "src/services/supabase/PaymentService.ts",
    "utf8",
  );
  const userService = readFileSync(
    "src/pages/admin/components/users/hooks/useUserService.ts",
    "utf8",
  );

  it("PaymentService no longer writes to transactions", () => {
    expect(/from\(['"]transactions['"]\)/.test(paymentService)).toBe(false);
  });

  it("PaymentService no longer calls record_discount_usage", () => {
    expect(paymentService.includes("record_discount_usage")).toBe(false);
  });

  it("PaymentService preserves the retired method signatures", () => {
    for (const name of [
      "createTransaction",
      "updateTransactionStatus",
      "recordDiscountUsage",
    ]) {
      expect(paymentService.includes(`async ${name}(`)).toBe(true);
    }
  });

  it("retired PaymentService methods return controlled failures", () => {
    const retiredMessages = paymentService.match(/are retired\./g) ?? [];
    expect(retiredMessages.length >= 3).toBe(true);
  });

  it("admin plan assignment no longer fabricates payment history", () => {
    expect(/from\(['"]transactions['"]\)/.test(userService)).toBe(false);
    expect(userService.includes("must NOT fabricate payment history")).toBe(true);
  });

  it("no other src module writes these legacy tables", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry.name)) continue;
        if (entry.name.endsWith(".test.ts")) continue;
        const text = readFileSync(full, "utf8");
        const touchesLegacy =
          /from\(['"](transactions|discount_code_usage)['"]\)\s*\.\s*(insert|update|delete|upsert)/.test(
            text,
          ) || /rpc\(['"]record_discount_usage['"]/.test(text);
        if (touchesLegacy) offenders.push(full);
      }
    };
    walk("src");
    expect(offenders).toEqual([]);
  });
});
