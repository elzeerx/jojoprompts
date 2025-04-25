
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { usePromptsData } from "./usePromptsData";
import { PromptStateManager } from "./components/PromptStateManager";
import { PromptsPageContent } from "./components/PromptsPageContent";
import { usePromptDeletion } from "./hooks/usePromptDeletion";

export default function PromptsPage() {
  const { loading: authLoading, session } = useAuth();
  const navigate = useNavigate();

  // Fetch prompts & categories
  const { prompts, setPrompts, categories, isLoading, error, reloadPrompts } = usePromptsData({ authLoading, session });
  const { handleDeletePrompt } = usePromptDeletion(setPrompts, reloadPrompts);

  if (!authLoading && !session) {
    navigate("/login");
  }

  return (
    <div className="w-full bg-background">
      <PromptStateManager prompts={prompts}>
        {({ selectedPrompt, setSelectedPrompt, detailsDialogOpen, setDetailsDialogOpen }) => (
          <PromptsPageContent
            prompts={prompts}
            categories={categories}
            isLoading={isLoading}
            error={error}
            reloadPrompts={reloadPrompts}
          />
        )}
      </PromptStateManager>
    </div>
  );
}
