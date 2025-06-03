import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { type Prompt, type PromptRow } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { PromptDetailsDialog } from "@/components/ui/prompt-details-dialog";
import { getPromptImage, getTextPromptDefaultImage } from "@/utils/image";
import { Lock, Crown, Heart, Play, FileAudio, Workflow } from "lucide-react";
import { Button } from "./button";
import { ImageWrapper } from "./prompt-card/ImageWrapper";
import { useIsMobile, useIsSmallMobile } from '@/hooks/use-mobile';

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
  const {
    session
  } = useAuth();
  const [favorited, setFavorited] = useState<boolean>(initiallyFavorited);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>('/placeholder.svg');
  const isMobile = useIsMobile();
  const isSmallMobile = useIsSmallMobile();

  useEffect(() => {
    async function loadImage() {
      try {
        let finalImageUrl = '/placeholder.svg';

        // Enhanced image path resolution logic
        if (prompt_type === 'text') {
          // For text prompts, prioritize default_image_path, then use default text prompt image
          if (prompt.default_image_path) {
            console.log(`Loading text prompt with default_image_path: ${prompt.default_image_path}`);
            finalImageUrl = await getPromptImage(prompt.default_image_path, 400, 85);
          } else {
            console.log(`Loading text prompt with default image for prompt: ${title}`);
            finalImageUrl = await getTextPromptDefaultImage();
          }
        } else {
          // For non-text prompts, check multiple possible image sources
          const primaryImagePath = mediaFiles.find(file => file.type === 'image')?.path || 
                                   prompt.image_path || 
                                   prompt.image_url;
          
          if (primaryImagePath) {
            console.log(`Loading ${prompt_type} prompt image from: ${primaryImagePath}`);
            finalImageUrl = await getPromptImage(primaryImagePath, 400, 85);
          } else {
            console.log(`No image path found for ${prompt_type} prompt: ${title}, using placeholder`);
          }
        }

        console.log(`Final image URL for "${title}": ${finalImageUrl}`);
        setImageUrl(finalImageUrl);
      } catch (error) {
        console.error(`Error loading image for prompt "${title}":`, error);
        setImageUrl('/placeholder.svg');
      }
    }

    loadImage();
  }, [prompt.image_path, prompt.default_image_path, prompt.image_url, mediaFiles, prompt_type, title]);

  const handleCardClick = () => {
    if (isLocked && onUpgradeClick) {
      onUpgradeClick();
    } else {
      setDetailsOpen(true);
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
        await supabase.from("favorites").delete().eq("user_id", session.user.id).eq("prompt_id", prompt.id);
      } else {
        await supabase.from("favorites").insert({
          user_id: session.user.id,
          prompt_id: prompt.id
        });
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

  // Get category badge color based on category
  const getCategoryBadgeStyle = (cat: string) => {
    const lowerCategory = cat.toLowerCase();
    
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

  // Function to get media type icon
  const getMediaTypeIcon = (file: any) => {
    if (file.type === 'video') {
      return <Play className="h-4 w-4 text-white" />;
    } else if (file.type === 'audio') {
      return <FileAudio className="h-4 w-4 text-white" />;
    } 
    return null;
  };

  // Check if this is an n8n workflow prompt
  const isN8nWorkflow = prompt_type === 'workflow' || category.toLowerCase().includes('n8n');

  return (
    <>
      <div 
        className={cn(
          "group cursor-pointer overflow-hidden bg-soft-bg rounded-2xl shadow-md border-0",
          "transition-all duration-300 hover:shadow-xl",
          // Mobile-optimized scaling and spacing
          isMobile ? "hover:scale-[1.01] active:scale-[0.99]" : "hover:scale-[1.02]",
          "p-3 sm:p-4 lg:p-6 space-y-2 sm:space-y-3 lg:space-y-4 flex flex-col relative",
          "touch-manipulation min-h-[280px] sm:min-h-[320px] lg:min-h-[400px]", // Responsive heights
          isSelected && "ring-2 ring-[#c49d68] shadow-lg",
          isLocked && "opacity-95"
        )} 
        onClick={handleCardClick}
      >
        {isLocked && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent flex items-center justify-center z-20 rounded-2xl">
            <div className="bg-black/80 backdrop-blur-sm p-3 sm:p-4 lg:p-6 rounded-xl flex flex-col items-center text-center max-w-[85%] sm:max-w-[90%]">
              <Lock className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-[#c49d68] mb-2 sm:mb-3" />
              <p className="text-white font-semibold text-xs sm:text-sm mb-1">Premium Content</p>
              <p className="text-white/80 text-xs sm:text-sm mb-2 sm:mb-3 lg:mb-4 max-w-[160px] sm:max-w-[180px] lg:max-w-[200px]">
                Upgrade your plan to access this content
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="bg-[#c49d68]/90 text-white hover:bg-[#c49d68] border-[#c49d68] text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onUpgradeClick) onUpgradeClick();
                }}
              >
                <Crown className="h-3 w-3 mr-1" />
                Upgrade Plan
              </Button>
            </div>
          </div>
        )}

        {/* Mobile-optimized category tag and favorite */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-1 sm:gap-2">
            <span className={cn(
              "inline-block px-2 py-1 text-xs font-medium rounded-lg",
              getCategoryBadgeStyle(category)
            )}>
              {isSmallMobile && category.length > 8 ? category.substring(0, 8) + '...' : category}
            </span>
            {isN8nWorkflow && (
              <Workflow className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
            )}
          </div>
          
          {session && (
            <button
              onClick={toggleFavorite}
              className={cn(
                // Enhanced mobile touch targets
                "p-2 rounded-full transition-all duration-200",
                "flex items-center justify-center min-w-[44px] min-h-[44px]", // Larger touch target
                "hover:bg-white/30 active:bg-white/50", // Better mobile feedback
                favorited 
                  ? "text-[#c49d68]" 
                  : "text-gray-400 hover:text-[#c49d68]"
              )}
            >
              <Heart className={cn("h-4 w-4", favorited && "fill-current")} />
            </button>
          )}
        </div>

        {/* Mobile-optimized title with better line heights */}
        <h3 className="text-gray-900 font-bold leading-tight flex-shrink-0">
          <span className={cn(
            "block line-clamp-2",
            isSmallMobile ? "text-sm min-h-[2rem]" : "text-base sm:text-lg lg:text-xl min-h-[2.5rem] sm:min-h-[3rem]"
          )}>
            {title}
          </span>
        </h3>

        {/* Mobile-optimized image with responsive aspect ratios */}
        <div className="relative overflow-hidden rounded-xl bg-white/50 flex-shrink-0">
          <div className={cn(
            // Different aspect ratios for different screen sizes
            isSmallMobile ? "aspect-[4/3]" : "aspect-video sm:aspect-square"
          )}>
            <ImageWrapper 
              src={imageUrl}
              alt={title}
              aspect={1}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          </div>
          
          {/* Mobile-optimized media indicators */}
          {mediaFiles.length > 1 && (
            <div className="absolute top-1 sm:top-2 right-1 sm:right-2 bg-black/70 text-white text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
              +{mediaFiles.length - 1} files
            </div>
          )}
          
          {mediaFiles.length > 0 && mediaFiles[0].type !== 'image' && (
            <div className="absolute bottom-1 sm:bottom-2 left-1 sm:left-2 bg-black/70 p-1 sm:p-1.5 lg:p-2 rounded-full">
              {getMediaTypeIcon(mediaFiles[0])}
            </div>
          )}
        </div>

        {/* Mobile-optimized description or workflow steps */}
        {isN8nWorkflow && workflowSteps.length > 0 ? (
          <div className="flex-grow space-y-1 sm:space-y-2">
            <div className="space-y-1">
              <h4 className="text-xs sm:text-sm font-semibold text-gray-800 flex items-center gap-1 sm:gap-2">
                <Workflow className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                Workflow Steps
              </h4>
              <div className="space-y-1">
                {workflowSteps.slice(0, isSmallMobile ? 1 : 2).map((step, index) => (
                  <div key={index} className="flex items-start gap-1 sm:gap-2 text-xs">
                    <span className="flex-shrink-0 w-4 h-4 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-medium text-xs">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-700 truncate text-xs">{step.name}</p>
                      <p className="text-gray-500 line-clamp-1 text-xs">{step.description}</p>
                    </div>
                  </div>
                ))}
                {workflowSteps.length > (isSmallMobile ? 1 : 2) && (
                  <p className="text-xs text-gray-500 pl-5 sm:pl-6">
                    +{workflowSteps.length - (isSmallMobile ? 1 : 2)} more steps
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className={cn(
            "text-gray-600 leading-relaxed flex-grow",
            isSmallMobile ? "text-xs line-clamp-2" : "text-sm line-clamp-2 sm:line-clamp-3"
          )}>
            {prompt_text}
          </p>
        )}
        
        {/* Mobile-optimized tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, isSmallMobile ? 2 : 3).map((tag, i) => (
              <span 
                key={i}
                className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-white/60 text-gray-700 text-xs rounded-md border border-gray-200"
              >
                {isSmallMobile && tag.length > 8 ? tag.substring(0, 8) + '...' : tag}
              </span>
            ))}
            {tags.length > (isSmallMobile ? 2 : 3) && (
              <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-white/60 text-gray-500 text-xs rounded-md border border-gray-200">
                +{tags.length - (isSmallMobile ? 2 : 3)} more
              </span>
            )}
          </div>
        )}

        {/* Mobile-optimized action buttons */}
        <div className="mt-auto pt-2 space-y-2 flex-shrink-0">
          {!isLocked && (
            <Button 
              className={cn(
                "w-full bg-[#c49d68] hover:bg-[#c49d68]/90 text-white font-semibold rounded-xl shadow-md transition-all duration-200",
                isSmallMobile ? "py-2 text-xs" : "py-3 text-sm sm:text-base"
              )}
            >
              {isN8nWorkflow ? "View Workflow" : "View Details"}
            </Button>
          )}
          
          {isAdmin && (
            <div className="flex gap-2 w-full">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 border-gray-300 hover:bg-gray-50 text-xs"
                onClick={e => {
                  e.stopPropagation();
                  onEdit?.(prompt.id);
                }}
              >
                Edit
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 text-xs" 
                onClick={e => {
                  e.stopPropagation();
                  onDelete?.(prompt.id);
                }}
              >
                Delete
              </Button>
            </div>
          )}
        </div>
      </div>

      {!isLocked && (
        <PromptDetailsDialog open={detailsOpen} onOpenChange={setDetailsOpen} prompt={prompt as PromptRow} />
      )}
    </>
  );
}
