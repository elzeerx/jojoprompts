import React, { useState } from 'react';
import { Platform } from '@/types/platform';
import { PlatformSelector } from './PlatformSelector';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface PlatformSelectorDialogProps {
  trigger?: React.ReactNode;
  onSelect: (platform: Platform) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function PlatformSelectorDialog({
  trigger,
  onSelect,
  open,
  onOpenChange
}: PlatformSelectorDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);

  const handleOpenChange = (newOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(newOpen);
    } else {
      setIsOpen(newOpen);
    }
  };

  const handleSelect = (platform: Platform) => {
    setSelectedPlatform(platform);
  };

  const handleConfirm = () => {
    if (selectedPlatform) {
      onSelect(selectedPlatform);
      handleOpenChange(false);
      setSelectedPlatform(null);
    }
  };

  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : isOpen;

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col sm:max-h-[80vh] p-0 sm:rounded-lg">
        <DialogHeader className="px-4 py-6 sm:px-6 border-b">
          <DialogTitle className="text-lg sm:text-xl">Select a Platform</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Choose the AI platform or tool you want to create a prompt for
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <PlatformSelector
            onSelect={handleSelect}
            selectedPlatformId={selectedPlatform?.id}
            showSearch={true}
            showCategoryTabs={true}
          />
        </div>

        <div className="flex justify-end gap-3 p-4 sm:p-6 border-t bg-background">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="flex-1 sm:flex-none"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedPlatform}
            className="flex-1 sm:flex-none"
          >
            Continue with {selectedPlatform?.name || 'Platform'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
