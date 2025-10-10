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
      
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select a Platform</DialogTitle>
          <DialogDescription>
            Choose the AI platform or tool you want to create a prompt for
          </DialogDescription>
        </DialogHeader>

        <PlatformSelector
          onSelect={handleSelect}
          selectedPlatformId={selectedPlatform?.id}
          showSearch={true}
          showCategoryTabs={true}
        />

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedPlatform}
          >
            Continue with {selectedPlatform?.name || 'Selected Platform'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
