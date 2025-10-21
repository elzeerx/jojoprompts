import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, ExternalLink, Plus } from 'lucide-react';

export interface PromptSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promptId: string;
  mode: 'create' | 'edit';
  onViewPrompt?: (promptId: string) => void;
  onCreateAnother?: () => void;
}

export function PromptSuccessDialog({
  open,
  onOpenChange,
  promptId,
  mode,
  onViewPrompt,
  onCreateAnother
}: PromptSuccessDialogProps) {
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 mx-auto mb-4">
            <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <DialogTitle className="text-center">
            {mode === 'edit' ? 'Prompt Updated!' : 'Prompt Created Successfully!'}
          </DialogTitle>
          <DialogDescription className="text-center">
            Your prompt has been {mode === 'edit' ? 'updated' : 'saved'} and is now available in your collection.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {onViewPrompt && (
            <Button
              variant="outline"
              onClick={() => onViewPrompt(promptId)}
              className="w-full sm:w-auto"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View Prompt
            </Button>
          )}
          
          {mode === 'create' && onCreateAnother && (
            <Button
              variant="outline"
              onClick={onCreateAnother}
              className="w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Another
            </Button>
          )}

          <Button
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
