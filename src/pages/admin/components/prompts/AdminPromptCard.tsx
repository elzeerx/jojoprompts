
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { PromptDetailsDialog } from "@/components/ui/prompt-details-dialog";
import { CopyButton } from "@/components/ui/copy-button";

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
  const [favorited, setFavorited] = useState<boolean>(initiallyFavorited);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Debug log to track metadata
  console.log("AdminPromptCard - Prompt metadata:", prompt.metadata);
  console.log("AdminPromptCard - Prompt ID:", prompt.id);
  console.log("AdminPromptCard - Prompt Title:", prompt.title);

  // Get category badge color based on category
  const getCategoryBadgeStyle = (category: string) => {
    const lowerCategory = category.toLowerCase();
    
    if (lowerCategory.includes('chatgpt') || lowerCategory.includes('text')) {
      return 'bg-[#c49d68] text-white'; // Warm gold
    } else if (lowerCategory.includes('midjourney') || lowerCategory.includes('image')) {
      return 'bg-[#7a9e9f] text-white'; // Muted teal
    } else if (lowerCategory.includes('n8n') || lowerCategory.includes('workflow')) {
      return 'bg-blue-600 text-white'; // Blue
    } else if (lowerCategory.includes('claude')) {
      return 'bg-orange-500 text-white'; // Orange
    } else if (lowerCategory.includes('gemini')) {
      return 'bg-purple-600 text-white'; // Purple
    } else if (lowerCategory.includes('video')) {
      return 'bg-red-500 text-white'; // Red
    } else if (lowerCategory.includes('audio')) {
      return 'bg-green-600 text-white'; // Green
    } else {
      return 'bg-gray-600 text-white'; // Default gray
    }
  };

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!session) {
      toast({
        title: "Authentication required",
        description: "Please log in to favorite prompts",
        variant: "destructive"
      });
      return;
    }

    try {
      if (favorited) {
        await supabase
          .from("favorites")
          .delete()
          .eq("user_id", session.user.id)
          .eq("prompt_id", prompt.id);
      } else {
        await supabase
          .from("favorites")
          .insert({ user_id: session.user.id, prompt_id: prompt.id });
      }
      
      setFavorited(!favorited);
    } catch (error) {
      console.error("Error toggling favorite:", error);
      toast({
        title: "Error",
        description: "Failed to update favorites",
        variant: "destructive"
      });
    }
  };

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

  // Extract metadata for display
  const category = prompt.metadata?.category || "N/A";
  const style = prompt.metadata?.style;
  const tags = prompt.metadata?.tags || [];
  const workflowSteps = prompt.metadata?.workflow_steps || [];

  console.log("AdminPromptCard - Extracted metadata:", { category, style, tags, workflowSteps });

  // Check if this is an n8n workflow prompt
  const isN8nWorkflow = prompt.prompt_type === 'workflow' || category.toLowerCase().includes('n8n');

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
