
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Copy, Eye } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
import { DiscountCodeDetailsDialog } from "./DiscountCodeDetailsDialog";

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
  applies_to_all_plans?: boolean;
  applicable_plans?: string[];
}

interface DiscountCodesTableProps {
  discountCodes: DiscountCode[];
  onToggleActive: (codeId: string, isActive: boolean) => void;
  onRefresh: () => void;
}

export function DiscountCodesTable({ discountCodes, onToggleActive, onRefresh }: DiscountCodesTableProps) {
  const [selectedCode, setSelectedCode] = useState<DiscountCode | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Discount code copied to clipboard",
    });
  };

  const getDiscountDisplay = (code: DiscountCode) => {
    if (code.discount_type === 'percentage') {
      return `${code.discount_value}%`;
    }
    return `$${code.discount_value}`;
  };

  const getExpirationStatus = (expirationDate: string | null) => {
    if (!expirationDate) return null;
    
    const now = new Date();
    const expiry = new Date(expirationDate);
    
    if (expiry < now) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    
    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry <= 7) {
      return <Badge variant="outline" className="border-yellow-400 text-yellow-600">Expires in {daysUntilExpiry}d</Badge>;
    }
    
    return <Badge variant="outline" className="border-green-400 text-green-600">Valid</Badge>;
  };

  const getUsageStatus = (code: DiscountCode) => {
    if (!code.usage_limit) return "Unlimited";
    
    const percentage = (code.times_used / code.usage_limit) * 100;
    
    if (percentage >= 100) {
      return <Badge variant="destructive">Fully Used</Badge>;
    } else if (percentage >= 80) {
      return <Badge variant="outline" className="border-yellow-400 text-yellow-600">
        {code.times_used}/{code.usage_limit}
      </Badge>;
    }
    
    return <span className="text-muted-foreground">{code.times_used}/{code.usage_limit}</span>;
  };

  const getPlanScope = (code: DiscountCode) => {
    if (code.applies_to_all_plans || code.applies_to_all_plans === undefined) {
      return <Badge variant="outline" className="border-blue-400 text-blue-600">All Plans</Badge>;
    }
    
    const planCount = code.applicable_plans?.length || 0;
    return <Badge variant="outline" className="border-purple-400 text-purple-600">
      {planCount} Plan{planCount !== 1 ? 's' : ''}
    </Badge>;
  };

  return (
    <>
      <Card className="border-warm-gold/20">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Plan Scope</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead>Expiration</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {discountCodes.map((code) => (
              <TableRow key={code.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium">{code.code}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(code.code)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="capitalize">
                    {code.discount_type}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="font-medium">{getDiscountDisplay(code)}</span>
                </TableCell>
                <TableCell>
                  {getPlanScope(code)}
                </TableCell>
                <TableCell>
                  {getUsageStatus(code)}
                </TableCell>
                <TableCell>
                  {code.expiration_date ? (
                    <div className="space-y-1">
                      <div className="text-sm">
                        {new Date(code.expiration_date).toLocaleDateString()}
                      </div>
                      {getExpirationStatus(code.expiration_date)}
                    </div>
                  ) : (
                    <Badge variant="outline" className="border-green-400 text-green-600">
                      No Expiry
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={code.is_active}
                      onCheckedChange={() => onToggleActive(code.id, code.is_active)}
                    />
                    <span className="text-sm">
                      {code.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {new Date(code.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedCode(code)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {discountCodes.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No discount codes found.
          </div>
        )}
      </Card>

      <DiscountCodeDetailsDialog
        code={selectedCode}
        open={!!selectedCode}
        onClose={() => setSelectedCode(null)}
        onRefresh={onRefresh}
      />
    </>
  );
}
