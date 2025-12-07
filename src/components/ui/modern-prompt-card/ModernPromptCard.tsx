import React, { useState } from 'react';
import { type Prompt, type PromptRow } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

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

export interface ModernPromptCardProps {
  prompt: Prompt | PromptRow;
  isAdmin?: boolean;
  onEdit?: (promptId: string) => void;
  onDelete?: (promptId: string) => void;
  initiallyFavorited?: boolean;
  isLocked?: boolean;
  onUpgradeClick?: () => void;
}

export function ModernPromptCard({
  prompt,
  isAdmin = false,
  onEdit,
  onDelete,
  initiallyFavorited = false,
  isLocked = false,
  onUpgradeClick
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

  // Get uploader info (cast to any for optional fields)
  const uploaderName = (prompt as any).uploader_name as string | undefined;
  const uploaderUsername = (prompt as any).uploader_username as string | undefined;

  const handleCardClick = () => {
    if (isLocked && onUpgradeClick) {
      onUpgradeClick();
    } else if (!adminMenuOpen) {
      setDetailsOpen(true);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAdminMenuOpen(false);
    onEdit?.(prompt.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAdminMenuOpen(false);
    onDelete?.(prompt.id);
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
          isLocked && "opacity-95"
        )}
        onClick={handleCardClick}
      >
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
    </>
  );
}
