import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DiscountCodeForm } from "./components/DiscountCodeForm";

interface DiscountCode {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  expiration_date: string | null;
  usage_limit: number | null;
  applies_to_all_plans?: boolean;
  applicable_plans?: string[];
}

interface EditDiscountCodeDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  discountCode: DiscountCode | null;
}

export function EditDiscountCodeDialog({ open, onClose, onSuccess, discountCode }: EditDiscountCodeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-2xl h-[90vh] flex flex-col p-0">
        <div className="flex-shrink-0 p-6 border-b border-gray-200">
          <span 
            className="inline-block rounded-lg text-white px-3 py-1 text-xs font-medium mb-3"
            style={{ backgroundColor: '#c49d68' }}
          >
            Discount
          </span>
          <div className="text-left">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
              Edit Discount Code
            </h2>
          </div>
        </div>
        
        <ScrollArea className="flex-1 px-6">
          <div className="py-6">
            {discountCode && (
              <DiscountCodeForm 
                onSuccess={onSuccess} 
                onCancel={onClose}
                initialData={discountCode}
                isEditing={true}
              />
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}