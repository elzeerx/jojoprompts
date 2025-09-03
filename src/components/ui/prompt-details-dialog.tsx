
import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { type Prompt, type PromptRow } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { getPromptImage, getTextPromptDefaultImage } from "@/utils/image";
import { PromptDetailsHeader } from "./prompt-details/PromptDetailsHeader";
import { PromptDetailsContent } from "./prompt-details/PromptDetailsContent";
import { PromptDetailsActions } from "./prompt-details/PromptDetailsActions";
import { MediaPreviewDialog } from "./prompt-details/MediaPreviewDialog";
import { LanguageTabs, type Language } from "./LanguageTabs";

interface PromptDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: Prompt | PromptRow;
}

export function PromptDetailsDialog({ open, onOpenChange, prompt }: PromptDetailsDialogProps) {
  const { session } = useAuth();
  const [favorited, setFavorited] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>('/placeholder.svg');
  const [copied, setCopied] = useState(false);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [mediaPreviewOpen, setMediaPreviewOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(() => {
    return (localStorage.getItem('preferred-language') as Language) || 'english';
  });

  const { title, prompt_text, metadata, prompt_type } = prompt;
  const category = metadata?.category || "ChatGPT";
  const tags = metadata?.tags || [];
  const model = metadata?.target_model || category;
  const useCase = metadata?.use_case;
  const style = metadata?.style;
  const mediaFiles = metadata?.media_files || [];
  const workflowSteps = metadata?.workflow_steps || [];
  const workflowFiles = metadata?.workflow_files || [];
  const translations = metadata?.translations;
  
  // Check if this prompt supports bilingual content (ChatGPT or Claude)
  const supportsBilingual = category.toLowerCase().includes('chatgpt') || category.toLowerCase().includes('claude');
  const hasTranslations = supportsBilingual && translations && !!(translations.arabic || translations.english);
  
  // Get current content based on selected language
  const getCurrentContent = () => {
    if (!hasTranslations) {
      return { title, prompt_text };
    }
    
    const currentTranslation = translations?.[selectedLanguage];
    return {
      title: currentTranslation?.title || title,
      prompt_text: currentTranslation?.prompt_text || prompt_text
    };
  };
  
  const currentContent = getCurrentContent();

  // Check if this is an n8n workflow prompt
  const isN8nWorkflow = prompt_type === 'workflow' || category.toLowerCase().includes('n8n');

  // Get primary image for main display
  const primaryImage = mediaFiles.find(file => file.type === 'image') || null;
  const primaryImagePath = primaryImage?.path || prompt.image_path || prompt.image_url;

  useEffect(() => {
    async function loadImage() {
      try {
        let url;
        if (prompt_type === 'text' && (!primaryImagePath)) {
          url = await getTextPromptDefaultImage();
        } else {
          url = await getPromptImage(primaryImagePath, 600, 85);
        }
        setImageUrl(url);
      } catch (error) {
        console.error('Error loading prompt image:', error);
        setImageUrl('/placeholder.svg');
      }
    }
    loadImage();

    // Check if prompt is favorited by current user
    if (session) {
      const checkFavoriteStatus = async () => {
        const { data } = await supabase
          .from("favorites")
          .select()
          .eq("user_id", session.user.id)
          .eq("prompt_id", prompt.id);
        
        setFavorited(!!data && data.length > 0);
      };
      
      checkFavoriteStatus();
    }
  }, [prompt.id, primaryImagePath, prompt_type, session]);

  const handleToggleFavorite = async () => {
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
      
      toast({
        title: favorited ? "Removed from favorites" : "Added to favorites",
        description: favorited ? "Prompt removed from your favorites" : "Prompt added to your favorites"
      });
    } catch (error) {
      console.error("Error toggling favorite:", error);
      toast({
        title: "Error",
        description: "Failed to update favorites",
        variant: "destructive"
      });
    }
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(currentContent.prompt_text);
      setCopied(true);
      toast({
        title: "Copied to clipboard",
        description: isN8nWorkflow ? "Workflow details have been copied to your clipboard" : "Prompt text has been copied to your clipboard"
      });
      
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive"
      });
    }
  };

  const handleLanguageChange = (language: Language) => {
    setSelectedLanguage(language);
    localStorage.setItem('preferred-language', language);
  };

  const handleMediaClick = (index: number) => {
    setSelectedMediaIndex(index);
    setMediaPreviewOpen(true);
  };

  // Get category color
  const getCategoryColor = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'chatgpt':
        return '#c49d68';
      case 'midjourney':
        return '#7a9e9f';
      case 'workflow':
      case 'n8n':
        return '#8b7fb8';
      default:
        return '#c49d68';
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="prompt-dialog max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 sm:p-8">
              <PromptDetailsHeader
                title={currentContent.title}
                category={category}
                isN8nWorkflow={isN8nWorkflow}
                session={session}
                favorited={favorited}
                onToggleFavorite={handleToggleFavorite}
                getCategoryColor={getCategoryColor}
              />

              <LanguageTabs
                hasTranslations={hasTranslations}
                selectedLanguage={selectedLanguage}
                onLanguageChange={handleLanguageChange}
              >
                {(language) => (
                  <PromptDetailsContent
                    imageUrl={imageUrl}
                    title={currentContent.title}
                    mediaFiles={mediaFiles}
                    isN8nWorkflow={isN8nWorkflow}
                    workflowSteps={workflowSteps}
                    workflowFiles={workflowFiles}
                    prompt_text={currentContent.prompt_text}
                    model={model}
                    useCase={useCase}
                    style={style}
                    tags={tags}
                    onMediaClick={handleMediaClick}
                    isRTL={language === 'arabic'}
                  />
                )}
              </LanguageTabs>

              <PromptDetailsActions
                isN8nWorkflow={isN8nWorkflow}
                copied={copied}
                onCopyPrompt={handleCopyPrompt}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <MediaPreviewDialog
        open={mediaPreviewOpen}
        onOpenChange={setMediaPreviewOpen}
        mediaFiles={mediaFiles}
        selectedIndex={selectedMediaIndex}
        title={title}
      />
    </>
  );
}
