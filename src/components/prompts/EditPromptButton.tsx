import React, { useState } from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { PromptWizardDialog } from './PromptWizardDialog';
import { PromptFormData } from '@/types/prompt-form';
import { Edit } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EditPromptButtonProps extends Omit<ButtonProps, 'onClick'> {
  promptId: string;
  onSuccess?: () => void;
  showIcon?: boolean;
  buttonText?: string;
}

export function EditPromptButton({
  promptId,
  onSuccess,
  showIcon = true,
  buttonText = 'Edit',
  className,
  ...buttonProps
}: EditPromptButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleComplete = async (data: PromptFormData) => {
    // Success is handled by the wizard's submission hook
    // Just close dialog and call onSuccess
    setDialogOpen(false);
    if (onSuccess) {
      onSuccess();
    }
  };

  return (
    <PromptWizardDialog
      trigger={
        <Button
          variant="outline"
          size="sm"
          className={cn(className)}
          {...buttonProps}
        >
          {showIcon && <Edit className="h-4 w-4 mr-2" />}
          {buttonText}
        </Button>
      }
      mode="edit"
      promptId={promptId}
      onComplete={handleComplete}
      open={dialogOpen}
      onOpenChange={setDialogOpen}
    />
  );
}
