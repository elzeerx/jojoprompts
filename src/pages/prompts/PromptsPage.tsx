
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { usePromptsData } from "./usePromptsData";
import { PromptStateManager } from "./components/PromptStateManager";
import { PromptsPageContent } from "./components/PromptsPageContent";
import { usePromptDeletion } from "./hooks/usePromptDeletion";
import { useEffect } from "react";
import { FloatingAddPromptButton } from "@/components/ui/FloatingAddPromptButton";

export default function PromptsPage() {
  const { loading: authLoading, session } = useAuth();
  const navigate = useNavigate();

  // Fetch prompts & categories
  const { prompts, setPrompts, categories, isLoading, error, reloadPrompts } = usePromptsData({ authLoading, session });
  const { handleDeletePrompt } = usePromptDeletion(setPrompts, reloadPrompts);

  // Reload prompts when the page is visited
  useEffect(() => {
    reloadPrompts();
  }, []);

  if (!authLoading && !session) {
    navigate("/login");
  }

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-background/80 via-background to-secondary/10 backdrop-blur-sm">
      <div className="absolute top-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 opacity-70 pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl translate-x-1/3 opacity-60 pointer-events-none"></div>
      
      <PromptStateManager prompts={prompts}>
        {({ selectedPrompt, setSelectedPrompt, detailsDialogOpen, setDetailsDialogOpen }) => (
          <>
            <PromptsPageContent
              prompts={prompts}
              categories={categories}
              isLoading={isLoading}
              error={error}
              reloadPrompts={reloadPrompts}
            />
            <FloatingAddPromptButton 
              reloadPrompts={reloadPrompts} 
              className="rounded-full bg-primary/90 hover:bg-primary shadow-lg backdrop-blur-sm"
            />
          </>
        )}
      </PromptStateManager>
    </div>
  );
}
