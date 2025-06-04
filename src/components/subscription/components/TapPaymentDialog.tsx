
import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface TapPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  planName: string;
  displayAmount: string;
  currency: string;
  isLoading: boolean;
  containerID: string;
}

export function TapPaymentDialog({
  isOpen,
  onClose,
  planName,
  displayAmount,
  currency,
  isLoading,
  containerID
}: TapPaymentDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="prompt-dialog sm:max-w-md">
        <div className="text-center mb-4">
          <h3 className="text-lg font-medium">
            {planName} Plan - {displayAmount} {currency}
          </h3>
          <p className="text-sm text-gray-500">
            Secure payment via Tap Payment
          </p>
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Initializing payment...</span>
          </div>
        ) : (
          <div id={containerID} className="min-h-[300px]"></div>
        )}
      </DialogContent>
    </Dialog>
  );
}
