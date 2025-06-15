
import { Badge } from "@/components/ui/badge";
import { getStatusBadgeColor } from "@/utils/transactionUtils";

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={getStatusBadgeColor(status)}>
      {status}
    </Badge>
  );
}
