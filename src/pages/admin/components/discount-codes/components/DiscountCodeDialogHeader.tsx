
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function DiscountCodeDialogHeader() {
  return (
    <div className="flex-shrink-0 p-6 border-b border-gray-200">
      <span 
        className="inline-block rounded-lg text-white px-3 py-1 text-xs font-medium mb-3"
        style={{ backgroundColor: '#c49d68' }}
      >
        Discount
      </span>
      <DialogHeader className="text-left p-0">
        <DialogTitle className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
          Create Discount Code
        </DialogTitle>
      </DialogHeader>
    </div>
  );
}
