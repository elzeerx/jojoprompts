
// Shared transaction types used across admin purchases components

export interface TransactionRecord {
  id: string;
  user_id: string;
  amount_usd: number;
  status: string;
  created_at: string;
  plan?: {
    name: string;
  };
  user_email?: string;
}
