import React, { useState } from 'react';
import { PromptWizard } from './PromptWizard';
import { PromptFormData } from '@/types/prompt-form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface PromptWizardDialogProps {
  trigger?: React.ReactNode;
  mode?: 'create' | 'edit';
  initialData?: Partial<PromptFormData>;
  onComplete: (data: PromptFormData) => Promise<void>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function PromptWizardDialog({
  trigger,
  mode = 'create',
  initialData,
  onComplete,
  open,
  onOpenChange
}: PromptWizardDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(newOpen);
    } else {
      setIsOpen(newOpen);
    }
  };

  const handleComplete = async (data: PromptFormData) => {
    await onComplete(data);
    handleOpenChange(false);
  };

  const handleCancel = () => {
    handleOpenChange(false);
  };

  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : isOpen;

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      
      <DialogContent className="max-w-5xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>
            {mode === 'edit' ? 'Edit Prompt' : 'Create New Prompt'}
          </DialogTitle>
          <DialogDescription>
            Follow the steps below to {mode === 'edit' ? 'update your' : 'create a new'} AI prompt
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] px-6 pb-6">
          <PromptWizard
            mode={mode}
            initialData={initialData}
            onComplete={handleComplete}
            onCancel={handleCancel}
          />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
