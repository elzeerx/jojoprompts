export interface MyOrderSummary {
  id: string;
  order_number: string | null;
  status: string;
  currency: string;
  total_fils: number;
  paid_fils: number;
  refunded_fils: number;
  placed_at: string | null;
  settled_at: string | null;
  created_at: string;
  item_count: number;
}
