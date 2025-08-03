
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Edit, Heart, Trash, AlertTriangle, Workflow } from "lucide-react";
import { type PromptRow } from "@/types";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { PromptDetailsDialog } from "@/components/ui/prompt-details-dialog";
import { CopyButton } from "@/components/ui/copy-button";
import { WorkflowDownloadSection } from "@/components/ui/workflow-download-section";
import { ImageWrapper } from "@/components/ui/prompt-card/ImageWrapper";
import { useImageLoading } from "@/components/ui/prompt-card/hooks/useImageLoading";
import { getCategoryBadgeStyle } from "@/components/ui/prompt-card/utils/categoryUtils";
import { useFavoriteLogic } from "@/components/ui/prompt-card/hooks/useFavoriteLogic";
import { extractPromptMetadata, isWorkflowPrompt } from "@/utils/promptUtils";

interface AdminPromptCardProps {
  prompt: PromptRow;
  onEdit: (promptId: string) => void;
  onDelete: (promptId: string) => void;
  initiallyFavorited?: boolean;
}

export function AdminPromptCard({ 
  prompt, 
  onEdit, 
  onDelete,
  initiallyFavorited = false
}: AdminPromptCardProps) {
  const { session } = useAuth();
  const { favorited, toggleFavorite } = useFavoriteLogic(prompt, initiallyFavorited);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const imageUrl = useImageLoading(prompt);



  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onEdit(prompt.id);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    setConfirmOpen(false);
    onDelete(prompt.id);
  };

  const handleCardClick = () => {
    setDetailsOpen(true);
  };

  // Extract metadata for display using utility
  const { category, style, tags, workflowSteps, workflowFiles } = extractPromptMetadata(prompt);
  const isN8nWorkflow = isWorkflowPrompt(prompt);

  return (
    <>
      <Card onClick={handleCardClick} className="cursor-pointer hover:shadow-md transition-shadow">
        <CardHeader className="relative">
          <CardTitle className="flex items-center gap-2">
            {prompt.title}
            {isN8nWorkflow && (
              <Workflow className="h-4 w-4 text-blue-600" />
            )}
          </CardTitle>
          <CardDescription>
            <div className="flex flex-wrap gap-1 mb-2">
              <Badge variant="secondary" className={cn("text-xs", getCategoryBadgeStyle(category))}>
                {category}
              </Badge>
              {style && (
                <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-800">
                  Style: {style}
                </Badge>
              )}
            </div>
            {/* Display tags if they exist */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.slice(0, 3).map((tag: string, index: number) => (
                  <Badge key={index} variant="outline" className="text-xs bg-green-100 text-green-800">
                    {tag}
                  </Badge>
                ))}
                {tags.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{tags.length - 3} more
                  </Badge>
                )}
              </div>
            )}
          </CardDescription>
          {session && (
            <div className="absolute top-4 right-4">
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn(
                  "h-8 w-8 rounded-full",
                  favorited && "text-red-500 hover:text-red-600"
                )}
                onClick={toggleFavorite}
              >
                <Heart className={cn("h-5 w-5", favorited && "fill-current")} />
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Small thumbnail image */}
          <div className="w-full h-32 mb-3">
            <ImageWrapper
              src={imageUrl}
              alt={prompt.title}
              className="w-full h-full object-cover rounded-md"
              disableAspectRatio={true}
            />
          </div>
          
          {/* Display workflow steps for n8n prompts */}
          {isN8nWorkflow && workflowSteps.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Workflow className="h-4 w-4 text-blue-600" />
                Workflow Steps ({workflowSteps.length})
              </h4>
              <div className="space-y-1">
                {workflowSteps.slice(0, 2).map((step: any, index: number) => (
                  <div key={index} className="flex items-start gap-2 text-xs">
                    <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-medium">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-700">{step.name}</p>
                      <p className="text-gray-500 line-clamp-1">{step.description}</p>
                    </div>
                  </div>
                ))}
                {workflowSteps.length > 2 && (
                  <p className="text-xs text-gray-500 pl-7">+{workflowSteps.length - 2} more steps</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {prompt.prompt_text.substring(0, 100)}...
            </p>
          )}

          {/* Only display workflow files when dialog is closed to prevent duplication */}
          {isN8nWorkflow && workflowFiles.length > 0 && !detailsOpen && (
            <WorkflowDownloadSection workflowFiles={workflowFiles} />
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <CopyButton value={prompt.prompt_text} className="w-full" />
          <div className="flex justify-between w-full">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleEditClick}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={handleDeleteClick}
                >
                  <Trash className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="prompt-dialog">
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-3">
                    <AlertTriangle className="h-8 w-8 text-red-500" />
                    Delete Prompt
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the prompt <strong>"{prompt.title}"</strong>. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="bg-white/40 p-6 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-3 text-red-600">
                    <AlertTriangle className="h-5 w-5" />
                    <p className="font-medium">This action is irreversible</p>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    The prompt and all associated data will be permanently deleted from the system.
                  </p>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleConfirmDelete}
                    className="bg-red-500 hover:bg-red-600 text-white"
                  >
                    Delete Prompt
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardFooter>
      </Card>

      <PromptDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        prompt={prompt}
      />
    </>
  );
}
