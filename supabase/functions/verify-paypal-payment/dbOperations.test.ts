import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { getTransaction } from "./dbOperations.ts";

function createMockSupabaseClient(data: any[]) {
  return {
    from() {
      let rows = [...data];
      const query = {
        select() { return query; },
        order(_c: string, { ascending }: { ascending: boolean }) {
          rows.sort((a, b) => {
            const da = new Date(a.created_at).getTime();
            const db = new Date(b.created_at).getTime();
            return ascending ? da - db : db - da;
          });
          return query;
        },
        eq(field: string, value: any) { rows = rows.filter(r => r[field] === value); return query; },
        or(expr: string) {
          const [p1, p2] = expr.split(',');
          const parse = (p: string) => { const [f, , v] = p.split('.'); return { field: f, value: v }; };
          const a = parse(p1); const b = parse(p2);
          rows = rows.filter(r => r[a.field] === a.value || r[b.field] === b.value);
          return query;
        },
        limit(n: number) { rows = rows.slice(0, n); return query; },
        async maybeSingle() { return { data: rows[0] ?? null }; },
      };
      return query;
    }
  };
}

Deno.test("lookup with both IDs only matches same transaction", async () => {
  const data = [
    { id: 1, paypal_order_id: "order1", paypal_payment_id: "payment1", created_at: "2024-01-01" },
    { id: 2, paypal_order_id: "order2", paypal_payment_id: "payment2", created_at: "2024-01-02" },
  ];
  const client = createMockSupabaseClient(data);
  const { data: tx } = await getTransaction(client, { orderId: "order1", paymentId: "payment1" });
  assertEquals(tx?.id, 1);

  const { data: none } = await getTransaction(client, { orderId: "order1", paymentId: "payment2" });
  assertEquals(none, null);
});

Deno.test("lookup with single ID behaves as before", async () => {
  const data = [
    { id: 1, paypal_order_id: "order1", paypal_payment_id: "payment1", created_at: "2024-01-01" },
    { id: 2, paypal_order_id: "order2", paypal_payment_id: "payment2", created_at: "2024-01-02" },
  ];
  const client = createMockSupabaseClient(data);
  const { data: byOrder } = await getTransaction(client, { orderId: "order1" });
  assertEquals(byOrder?.id, 1);

  const { data: byPayment } = await getTransaction(client, { paymentId: "payment2" });
  assertEquals(byPayment?.id, 2);
});
