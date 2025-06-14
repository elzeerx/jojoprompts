
import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface PayPalErrorDisplayProps {
  error: string;
}

export function PayPalErrorDisplay({ error }: PayPalErrorDisplayProps) {
  return (
    <div className="w-full p-4 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-start gap-2">
        <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-red-800 font-medium">Payment System Error</p>
          <p className="text-red-700 text-sm mt-1">{error}</p>
        </div>
      </div>
      <Button 
        variant="outline" 
        className="w-full mt-3" 
        onClick={() => window.location.reload()}
      >
        Retry Payment Setup
      </Button>
    </div>
  );
}
