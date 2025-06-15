
import { TransactionRecord } from "@/types/transaction";

export function exportTransactionsToCSV(transactions: TransactionRecord[]) {
  const csvData = transactions.map(transaction => ({
    Date: new Date(transaction.created_at).toLocaleDateString(),
    Email: transaction.user_email,
    Plan: transaction.plan?.name,
    'Amount USD': transaction.amount_usd,
    Status: transaction.status,
  }));

  const csv = [
    Object.keys(csvData[0] || {}).join(','),
    ...csvData.map(row => Object.values(row).join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transaction_history_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}
