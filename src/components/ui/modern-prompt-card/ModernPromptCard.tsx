import React, { useState } from 'react';
import { type Prompt, type PromptRow } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Check, Crown, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { getRequiredTierForPrompt } from '@/utils/subscription';

import { useFavoriteLogic } from '../prompt-card/hooks/useFavoriteLogic';
import { useImageLoading } from '../prompt-card/hooks/useImageLoading';
import { LockedOverlay } from '../prompt-card/components/LockedOverlay';
import { ImageSection } from './components/ImageSection';
import { ContentBody } from './components/ContentBody';
import { CardFooter } from './components/CardFooter';
import { ModernDetailModal } from '../modern-detail-modal/ModernDetailModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SimplifiedPromptDialog } from '@/components/prompts/SimplifiedPromptDialog';

export interface ModernPromptCardProps {
  prompt: Prompt | PromptRow;
  isAdmin?: boolean;
  onEdit?: (promptId: string) => void;
  onDelete?: (promptId: string) => void;
  onEditSuccess?: () => void;
  initiallyFavorited?: boolean;
  isLocked?: boolean;
  onUpgradeClick?: () => void;
  /** Enable selection mode (for bulk operations) */
  isSelectable?: boolean;
  /** Whether the card is currently selected */
  isSelected?: boolean;
  /** Callback when selection changes */
  onSelect?: (promptId: string) => void;
}

/** Tier badge component showing which plan is required */
function TierBadge({ 
  promptType, 
  category, 
  modelType 
}: { 
  promptType?: string; 
  category?: string; 
  modelType?: string; 
}) {
  const requiredTier = getRequiredTierForPrompt(promptType, category, modelType);
  
  const tierConfig = {
    basic: { label: 'Basic', price: '$55', color: 'bg-gray-600' },
    standard: { label: 'Standard', price: '$65', color: 'bg-blue-600' },
    premium: { label: 'Premium', price: '$80+', color: 'bg-warm-gold' }
  };
  
  const config = tierConfig[requiredTier];
  
  return (
    <div className="absolute top-3 right-3 z-20">
      <div className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-full",
        "text-white text-xs font-semibold",
        "shadow-md backdrop-blur-sm",
        config.color
      )}>
        <Crown size={12} />
        <span>{config.label}</span>
      </div>
    </div>
  );
}

export function ModernPromptCard({
  prompt,
  isAdmin = false,
  onEdit,
  onDelete,
  onEditSuccess,
  initiallyFavorited = false,
  isLocked = false,
  onUpgradeClick,
  isSelectable = false,
  isSelected = false,
  onSelect
}: ModernPromptCardProps) {
  const { title, prompt_text, metadata, prompt_type } = prompt;
  const category = metadata?.category || 'ChatGPT';
  const tags = metadata?.tags || [];
  const modelType = metadata?.model_type;
  
  const { session } = useAuth();
  const imageUrl = useImageLoading(prompt);
  const { favorited, toggleFavorite } = useFavoriteLogic(prompt, initiallyFavorited);
  
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Get uploader info (cast to any for optional fields)
  const uploaderName = (prompt as any).uploader_name as string | undefined;
  const uploaderUsername = (prompt as any).uploader_username as string | undefined;
  const uploaderAvatarUrl = (prompt as any).uploader_avatar_url as string | undefined;

  const handleCardClick = () => {
    if (isSelectable && onSelect) {
      onSelect(prompt.id);
    } else if (isLocked && onUpgradeClick) {
      onUpgradeClick();
    } else if (!adminMenuOpen) {
      setDetailsOpen(true);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAdminMenuOpen(false);
    setEditDialogOpen(true);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAdminMenuOpen(false);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    setDeleteDialogOpen(false);
    onDelete?.(prompt.id);
  };

  const handleEditSuccess = () => {
    setEditDialogOpen(false);
    onEditSuccess?.();
  };

  return (
    <>
      <div
        className={cn(
          "group relative flex flex-col",
          "bg-white rounded-2xl",
          "border border-gray-100",
          "shadow-sm transition-all duration-300",
          "hover:shadow-md hover:-translate-y-1",
          "overflow-hidden cursor-pointer",
          "touch-manipulation",
          isLocked && "opacity-95",
          isSelected && "ring-2 ring-warm-gold ring-offset-2"
        )}
        onClick={handleCardClick}
      >
        {/* Selection Checkbox */}
        {isSelectable && (
          <div className="absolute top-3 right-3 z-20">
            <div
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center",
                "border-2 transition-all duration-200",
                isSelected 
                  ? "bg-warm-gold border-warm-gold text-white" 
                  : "bg-white/80 border-gray-300 hover:border-warm-gold"
              )}
            >
              {isSelected && <Check size={14} />}
            </div>
          </div>
        )}

        {/* Tier Badge for Locked Cards */}
        {isLocked && (
          <TierBadge 
            promptType={prompt_type}
            category={category}
            modelType={modelType}
          />
        )}

        {/* Locked Overlay */}
        {isLocked && <LockedOverlay onUpgradeClick={onUpgradeClick} />}

        {/* Image Section with Admin Overlay */}
        <div className="relative">
          <ImageSection
            imageUrl={imageUrl}
            title={title}
            isAdmin={false} // We handle admin menu separately
          />
          
          {/* Admin Dropdown Menu */}
          {isAdmin && (
            <div className="absolute top-3 left-3 z-10">
              <DropdownMenu open={adminMenuOpen} onOpenChange={setAdminMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      "p-2 rounded-full",
                      "bg-white/80 backdrop-blur-sm",
                      "text-gray-600 hover:bg-white hover:text-gray-900",
                      "transition-all duration-200 shadow-sm",
                      "opacity-0 group-hover:opacity-100",
                      "min-h-[36px] min-w-[36px] flex items-center justify-center",
                      adminMenuOpen && "opacity-100"
                    )}
                    aria-label="Admin actions"
                  >
                    <MoreHorizontal size={18} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-40">
                  <DropdownMenuItem onClick={handleEdit} className="cursor-pointer">
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={handleDelete} 
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Content Body */}
        <ContentBody
          title={title}
          description={prompt_text}
          category={category}
          tags={tags}
          modelType={modelType}
          isLocked={isLocked}
        />

        {/* Footer */}
        <CardFooter
          uploaderName={uploaderName}
          uploaderUsername={uploaderUsername}
          avatarUrl={uploaderAvatarUrl}
          favorited={favorited}
          onFavoriteClick={toggleFavorite}
          isLocked={isLocked}
        />
      </div>

      {/* Detail Modal */}
      {!isLocked && (
        <ModernDetailModal
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          prompt={prompt as PromptRow}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Prompt</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      {isAdmin && (
        <SimplifiedPromptDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          editingPrompt={prompt as PromptRow}
          onSuccess={handleEditSuccess}
        />
      )}
    </>
  );
}
