
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

  // Redirect unauthenticated users to pricing page instead of login
  if (!authLoading && !session) {
    navigate("/pricing");
    return null;
  }

  return (
    <div className="w-full bg-soft-bg min-h-screen">
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
            <FloatingAddPromptButton reloadPrompts={reloadPrompts} />
          </>
        )}
      </PromptStateManager>
    </div>
  );
}
