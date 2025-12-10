import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { createLogger } from '@/utils/logging';
import { handleError } from '@/utils/errorHandler';

const logger = createLogger('DELETE_DISCOUNT_CODE');

interface DiscountCode {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
}

interface DeleteDiscountCodeDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  discountCode: DiscountCode | null;
}

export function DeleteDiscountCodeDialog({ open, onClose, onSuccess, discountCode }: DeleteDiscountCodeDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!discountCode) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("discount_codes")
        .delete()
        .eq("id", discountCode.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Discount code deleted successfully",
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      const appError = handleError(error, { component: 'DeleteDiscountCodeDialog', action: 'deleteCode' });
      logger.error('Error deleting discount code', { error: appError, codeId: discountCode.id });
      toast({
        title: "Error",
        description: "Failed to delete discount code",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getDiscountDisplay = (code: DiscountCode) => {
    return code.discount_type === 'percentage' 
      ? `${code.discount_value}%` 
      : `$${code.discount_value}`;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <DialogTitle className="text-xl font-semibold text-gray-900">
            Delete Discount Code
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            Are you sure you want to delete this discount code? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {discountCode && (
          <div className="my-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="font-mono text-lg font-bold text-gray-900 mb-1">
                {discountCode.code}
              </div>
              <div className="text-sm text-gray-600">
                {getDiscountDisplay(discountCode)} discount
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="flex-1 order-2 sm:order-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            disabled={loading}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white order-1 sm:order-2"
          >
            {loading ? "Deleting..." : "Delete Code"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}