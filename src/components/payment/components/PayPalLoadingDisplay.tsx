
import React from 'react';
import { Loader2 } from 'lucide-react';

interface PayPalLoadingDisplayProps {
  message: string;
  isProcessing?: boolean;
}

export function PayPalLoadingDisplay({ message, isProcessing = false }: PayPalLoadingDisplayProps) {
  return (
    <div className={`w-full p-4 border rounded-lg ${
      isProcessing ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
    }`}>
      <div className="flex items-center justify-center gap-2">
        <Loader2 className={`h-5 w-5 animate-spin ${
          isProcessing ? 'text-blue-600' : 'text-gray-600'
        }`} />
        <span className={`font-medium ${
          isProcessing ? 'text-blue-700' : 'text-gray-700'
        }`}>
          {message}
        </span>
      </div>
      {isProcessing && (
        <p className="text-blue-600 text-sm text-center mt-2">
          Please do not close this window
        </p>
      )}
    </div>
  );
}
