
import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { GlobalSearch } from './GlobalSearch';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
  const handleSearch = (query: string, filters: any) => {
    console.log('Search query:', query, 'Filters:', filters);
    // TODO: Implement actual search functionality
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <div className="p-4">
          <GlobalSearch 
            onSearch={handleSearch}
            placeholder="Search prompts..."
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
