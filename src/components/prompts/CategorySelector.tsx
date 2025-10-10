import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface CategorySelectorProps {
  value?: string;
  onChange: (categoryId: string) => void;
  categories: Category[];
  onCreateCategory?: (name: string) => Promise<void>;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export function CategorySelector({
  value,
  onChange,
  categories,
  onCreateCategory,
  error,
  disabled = false,
  className
}: CategorySelectorProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim() || !onCreateCategory) return;

    setIsCreating(true);
    try {
      await onCreateCategory(newCategoryName.trim());
      setNewCategoryName('');
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Failed to create category:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const hasError = !!error;

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor="category" className="text-sm font-medium">
        Category
      </Label>

      <div className="flex gap-2">
        <Select value={value} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger
            id="category"
            className={cn(hasError && "border-destructive focus:ring-destructive", "flex-1")}
            aria-invalid={hasError}
            aria-describedby={hasError ? "category-error" : undefined}
          >
            <SelectValue placeholder="Select a category..." />
          </SelectTrigger>
          <SelectContent className="z-50 bg-popover">
            {categories.length === 0 ? (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                No categories available
              </div>
            ) : (
              categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        {onCreateCategory && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                type="button" 
                variant="outline" 
                size="icon" 
                disabled={disabled}
                className="flex-shrink-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Category</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="new-category">Category Name</Label>
                  <Input
                    id="new-category"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="e.g., Marketing, Technical, Creative..."
                    maxLength={50}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleCreateCategory();
                      }
                    }}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    {newCategoryName.length}/50 characters
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      setNewCategoryName('');
                    }}
                    disabled={isCreating}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleCreateCategory}
                    disabled={!newCategoryName.trim() || isCreating}
                  >
                    {isCreating ? 'Creating...' : 'Create Category'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {hasError && (
        <p id="category-error" className="text-sm text-destructive animate-fade-in">
          {error}
        </p>
      )}
    </div>
  );
}
