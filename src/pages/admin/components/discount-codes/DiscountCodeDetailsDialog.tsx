
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Calendar, Users, TrendingUp } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createLogger } from '@/utils/logging';
import { handleError } from '@/utils/errorHandler';

const logger = createLogger('DISCOUNT_CODE_DETAILS');

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

interface Usage {
  id: string;
  used_at: string;
  user_id: string;
  user_email?: string;
}

interface DiscountCodeDetailsDialogProps {
  code: DiscountCode | null;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function DiscountCodeDetailsDialog({ code, open, onClose, onRefresh }: DiscountCodeDetailsDialogProps) {
  const [usageHistory, setUsageHistory] = useState<Usage[]>([]);
  const [loadingUsage, setLoadingUsage] = useState(false);

  useEffect(() => {
    if (code && open) {
      fetchUsageHistory();
    }
  }, [code, open]);

  const fetchUsageHistory = async () => {
    if (!code) return;
    
    setLoadingUsage(true);
    try {
      const { data, error } = await supabase
        .from("discount_code_usage")
        .select("*")
        .eq("discount_code_id", code.id)
        .order("used_at", { ascending: false });

      if (error) throw error;

      // Get user emails
      const userIds = [...new Set(data?.map(u => u.user_id) || [])];
      const { data: userData } = await supabase.auth.admin.listUsers();
      
      const userEmailMap = new Map();
      if (userData && Array.isArray(userData)) {
        userData.forEach((user: any) => {
          userEmailMap.set(user.id, user.email);
        });
      }

      const enrichedUsage = data?.map(usage => ({
        ...usage,
        user_email: userEmailMap.get(usage.user_id) || 'Unknown'
      })) || [];

      setUsageHistory(enrichedUsage);
    } catch (error) {
      const appError = handleError(error, { component: 'DiscountCodeDetailsDialog', action: 'fetchUsageHistory' });
      logger.error('Error fetching usage history', { error: appError, codeId: code?.id });
    } finally {
      setLoadingUsage(false);
    }
  };

  if (!code) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Discount code copied to clipboard",
    });
  };

  const getDiscountDisplay = () => {
    if (code.discount_type === 'percentage') {
      return `${code.discount_value}%`;
    }
    return `$${code.discount_value}`;
  };

  const getExpirationStatus = () => {
    if (!code.expiration_date) return 'No expiration';
    
    const now = new Date();
    const expiry = new Date(code.expiration_date);
    
    if (expiry < now) {
      return 'Expired';
    }
    
    return `Expires ${expiry.toLocaleDateString()}`;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono">{code.code}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(code.code)}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Code Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Discount Value</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{getDiscountDisplay()}</div>
                <p className="text-xs text-muted-foreground capitalize">
                  {code.discount_type} discount
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Usage</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{code.times_used}</div>
                <p className="text-xs text-muted-foreground">
                  {code.usage_limit ? `of ${code.usage_limit} limit` : 'unlimited'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Status</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Badge className={code.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {code.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    {getExpirationStatus()}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Usage History */}
          <Card>
            <CardHeader>
              <CardTitle>Usage History</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingUsage ? (
                <div className="text-center py-4">Loading...</div>
              ) : usageHistory.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {usageHistory.map((usage) => (
                    <div key={usage.id} className="flex justify-between items-center p-2 border rounded">
                      <div>
                        <div className="font-medium">{usage.user_email}</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(usage.used_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  No usage history yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* Additional Details */}
          <Card>
            <CardHeader>
              <CardTitle>Code Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created:</span>
                <span>{new Date(code.created_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Code:</span>
                <span className="font-mono">{code.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type:</span>
                <Badge variant="secondary" className="capitalize">
                  {code.discount_type}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Value:</span>
                <span className="font-medium">{getDiscountDisplay()}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
