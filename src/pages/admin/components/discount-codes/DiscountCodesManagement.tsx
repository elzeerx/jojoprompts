
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DiscountCodesTable } from "./DiscountCodesTable";
import { CreateDiscountCodeDialog } from "./CreateDiscountCodeDialog";
import { DiscountCodeStats } from "./DiscountCodeStats";
import { createLogger } from '@/utils/logging';
import { handleError } from '@/utils/errorHandler';

const logger = createLogger('DISCOUNT_CODES_MGMT');

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
  created_by: string;
}

export default function DiscountCodesManagement() {
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const fetchDiscountCodes = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("discount_codes")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter === "active") {
        query = query.eq("is_active", true);
      } else if (statusFilter === "inactive") {
        query = query.eq("is_active", false);
      }

      if (typeFilter !== "all") {
        query = query.eq("discount_type", typeFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setDiscountCodes(data || []);
    } catch (error) {
      const appError = handleError(error, { component: 'DiscountCodesManagement', action: 'fetchCodes' });
      logger.error('Error fetching discount codes', { error: appError });
      toast({
        title: "Error",
        description: "Failed to fetch discount codes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscountCodes();
  }, [statusFilter, typeFilter]);

  const filteredCodes = discountCodes.filter(code => {
    if (!searchTerm) return true;
    return code.code.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleCodeCreated = () => {
    setCreateDialogOpen(false);
    fetchDiscountCodes();
  };

  const handleToggleActive = async (codeId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("discount_codes")
        .update({ is_active: !isActive, updated_at: new Date().toISOString() })
        .eq("id", codeId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Discount code ${!isActive ? 'activated' : 'deactivated'} successfully`,
      });

      fetchDiscountCodes();
    } catch (error) {
      const appError = handleError(error, { component: 'DiscountCodesManagement', action: 'toggleActive' });
      logger.error('Error updating discount code', { error: appError, codeId });
      toast({
        title: "Error",
        description: "Failed to update discount code",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-dark-base">Discount Codes</h2>
          <p className="text-muted-foreground">Create and manage discount codes for customers</p>
        </div>
        <Button 
          onClick={() => setCreateDialogOpen(true)}
          className="bg-warm-gold hover:bg-warm-gold/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Code
        </Button>
      </div>

      <DiscountCodeStats discountCodes={filteredCodes} />

      <Card className="border-warm-gold/20 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Type</label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="percentage">Percentage</SelectItem>
                <SelectItem value="fixed">Fixed Amount</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-warm-gold" />
        </div>
      ) : (
        <DiscountCodesTable
          discountCodes={filteredCodes}
          onToggleActive={handleToggleActive}
          onRefresh={fetchDiscountCodes}
        />
      )}

      <CreateDiscountCodeDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={handleCodeCreated}
      />
    </div>
  );
}
