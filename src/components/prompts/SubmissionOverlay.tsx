import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SubmissionOverlayProps {
  isSubmitting: boolean;
  message?: string;
  className?: string;
}

export function SubmissionOverlay({
  isSubmitting,
  message = 'Saving your prompt...',
  className
}: SubmissionOverlayProps) {
  if (!isSubmitting) return null;

  return (
    <div className={cn(
      "fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center",
      className
    )}>
      <div className="bg-card p-6 rounded-lg shadow-lg space-y-4 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-sm font-medium">{message}</p>
        <p className="text-xs text-muted-foreground">
          Please don't close this window
        </p>
      </div>
    </div>
  );
}
