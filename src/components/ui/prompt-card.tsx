import React from "react";
import { type Prompt, type PromptRow } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { PromptDetailsDialog } from "@/components/ui/prompt-details-dialog";
import { useIsMobile, useIsSmallMobile } from '@/hooks/use-mobile';

import { useFavoriteLogic } from "./prompt-card/hooks/useFavoriteLogic";
import { useImageLoading } from "./prompt-card/hooks/useImageLoading";
import { getCategoryBadgeStyle } from "./prompt-card/utils/categoryUtils.tsx";
import { LockedOverlay } from "@/components/ui/prompt-card/components/LockedOverlay";
import { CardHeader } from "@/components/ui/prompt-card/components/CardHeader";
import { CardContent } from "@/components/ui/prompt-card/components/CardContent";
import { CardFooter } from "@/components/ui/prompt-card/components/CardFooter";
import { cn } from "@/lib/utils";

interface PromptCardProps {
  prompt: Prompt | PromptRow;
  isSelectable?: boolean;
  isSelected?: boolean;
  onSelect?: (promptId: string) => void;
  isAdmin?: boolean;
  onEdit?: (promptId: string) => void;
  onDelete?: (promptId: string) => void;
  initiallyFavorited?: boolean;
  isLocked?: boolean;
  onUpgradeClick?: () => void;
}

export function PromptCard({
  prompt,
  isSelectable = false,
  isSelected = false,
  onSelect,
  isAdmin = false,
  onEdit,
  onDelete,
  initiallyFavorited = false,
  isLocked = false,
  onUpgradeClick
}: PromptCardProps) {
  const {
    title,
    prompt_text,
    metadata,
    prompt_type
  } = prompt;
  const category = metadata?.category || "ChatGPT";
  const tags = metadata?.tags || [];
  const mediaFiles = metadata?.media_files || [];
  const workflowSteps = metadata?.workflow_steps || [];
  const { session } = useAuth();
  const isMobile = useIsMobile();
  const isSmallMobile = useIsSmallMobile();
  const imageUrl = useImageLoading(prompt);
  const { favorited, toggleFavorite } = useFavoriteLogic(prompt, initiallyFavorited);

  const isN8nWorkflow = prompt_type === 'workflow' || category.toLowerCase().includes('n8n');

  const [detailsOpen, setDetailsOpen] = React.useState(false);

  const handleCardClick = () => {
    if (isLocked && onUpgradeClick) {
      onUpgradeClick();
    } else {
      setDetailsOpen(true);
    }
  };

  return (
    <>
      <div
        className={cn(
          "group cursor-pointer overflow-hidden bg-soft-bg rounded-2xl shadow-md border-0",
          "transition-all duration-300 hover:shadow-xl",
          isMobile ? "hover:scale-[1.01] active:scale-[0.99]" : "hover:scale-[1.02]",
          "p-3 sm:p-4 lg:p-6 space-y-2 sm:space-y-3 lg:space-y-4 flex flex-col relative",
          "touch-manipulation min-h-[280px] sm:min-h-[320px] lg:min-h-[400px]",
          isSelected && "ring-2 ring-[#c49d68] shadow-lg",
          isLocked && "opacity-95"
        )}
        onClick={handleCardClick}
      >
        {isLocked && <LockedOverlay onUpgradeClick={onUpgradeClick} />}

        <CardHeader
          category={category}
          isN8nWorkflow={isN8nWorkflow}
          favorited={favorited}
          toggleFavorite={toggleFavorite}
          session={session}
          isSmallMobile={isSmallMobile}
        />

        <CardContent
          title={title}
          imageUrl={imageUrl}
          isSmallMobile={isSmallMobile}
          prompt_text={prompt_text}
          isN8nWorkflow={isN8nWorkflow}
          workflowSteps={workflowSteps}
          mediaFiles={mediaFiles}
        />

        <CardFooter
          tags={tags}
          isSmallMobile={isSmallMobile}
          isLocked={isLocked}
          isAdmin={isAdmin}
          onEdit={onEdit}
          onDelete={onDelete}
          promptId={prompt.id}
          isN8nWorkflow={isN8nWorkflow}
          uploaderName={(prompt as any).uploader_name}
          category={category}
        />
      </div>
      {!isLocked && (
        <PromptDetailsDialog open={detailsOpen} onOpenChange={setDetailsOpen} prompt={prompt as PromptRow} />
      )}
    </>
  );
}
