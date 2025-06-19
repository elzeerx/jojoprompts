
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DiscountCodeDialogHeader } from "./components/DiscountCodeDialogHeader";
import { DiscountCodeForm } from "./components/DiscountCodeForm";

interface CreateDiscountCodeDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateDiscountCodeDialog({ open, onClose, onSuccess }: CreateDiscountCodeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-2xl h-[90vh] flex flex-col p-0">
        <DiscountCodeDialogHeader />
        
        <ScrollArea className="flex-1 px-6">
          <div className="py-6">
            <DiscountCodeForm onSuccess={onSuccess} onCancel={onClose} />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
