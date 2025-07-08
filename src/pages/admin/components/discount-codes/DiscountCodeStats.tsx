
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ticket, TrendingUp, Clock, Users } from "lucide-react";

interface DiscountCode {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  expiration_date: string | null;
  usage_limit: number | null;
  times_used: number;
  is_active: boolean;
  created_at: string;
}

interface DiscountCodeStatsProps {
  discountCodes: DiscountCode[];
}

export function DiscountCodeStats({ discountCodes }: DiscountCodeStatsProps) {
  const activeCodes = discountCodes.filter(code => code.is_active);
  const totalUsage = discountCodes.reduce((sum, code) => sum + code.times_used, 0);
  const expiredCodes = discountCodes.filter(code => 
    code.expiration_date && new Date(code.expiration_date) < new Date()
  );
  const fullyUsedCodes = discountCodes.filter(code => 
    code.usage_limit && code.times_used >= code.usage_limit
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="border-warm-gold/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Codes</CardTitle>
          <Ticket className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{discountCodes.length}</div>
          <p className="text-xs text-muted-foreground">
            {activeCodes.length} active
          </p>
        </CardContent>
      </Card>

      <Card className="border-warm-gold/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Usage</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalUsage}</div>
          <p className="text-xs text-muted-foreground">
            Times codes were used
          </p>
        </CardContent>
      </Card>

      <Card className="border-warm-gold/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Expired Codes</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{expiredCodes.length}</div>
          <p className="text-xs text-muted-foreground">
            Past expiration date
          </p>
        </CardContent>
      </Card>

      <Card className="border-warm-gold/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Fully Used</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{fullyUsedCodes.length}</div>
          <p className="text-xs text-muted-foreground">
            Reached usage limit
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
