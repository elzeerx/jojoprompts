import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { FloatingAddPromptButton } from "@/components/ui/FloatingAddPromptButton";
import { RefactoredPromptsContent } from "./components/RefactoredPromptsContent";
import { usePromptFilters } from "@/hooks/usePromptFilters";
import { PromptService } from "@/services/PromptService";
import type { PromptRow } from "@/types/prompts";
import { createLogger } from '@/utils/logging';
import { useUserSubscription } from "@/hooks/useUserSubscription";
import { isPrivilegedUser } from "@/utils/auth";

const logger = createLogger('PROMPTS_PAGE');

export default function PromptsPage() {
  const { loading: authLoading, session, userRole } = useAuth();
  const navigate = useNavigate();
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { userSubscription, isLoading: subLoading } = useUserSubscription(session?.user?.id);
  const filters = usePromptFilters();

  // Handle authentication and subscription redirect
  useEffect(() => {
    if (authLoading || subLoading) return;
    
    // Not logged in -> redirect to login
    if (!session) {
      navigate("/login");
      return;
    }
    
    // Privileged users (admin, prompter, jadmin) always have access
    if (isPrivilegedUser(userRole)) return;
    
    // Regular users without subscription -> redirect to pricing
    if (!userSubscription) {
      navigate("/pricing", { replace: true });
    }
  }, [authLoading, subLoading, session, userRole, userSubscription, navigate]);

  // Load prompts with optimizations
  const loadPrompts = async () => {
    if (authLoading || !session) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await PromptService.getPrompts({
        category: filters.debouncedSearchQuery ? undefined : filters.filters.category,
        search: filters.debouncedSearchQuery,
        type: filters.filters.promptType,
        orderBy: filters.filters.sortBy,
        orderDirection: filters.filters.sortOrder
      });
      
      if (result.error) {
        setError(result.error);
      } else {
        setPrompts(result.data);
      }
    } catch (err: any) {
      setError('Failed to load prompts');
      logger.error('Error loading prompts', { error: err.message || err });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && session) {
      loadPrompts();
    }
  }, [authLoading, session, filters.debouncedSearchQuery, filters.filters.category, filters.filters.promptType, filters.filters.sortBy, filters.filters.sortOrder]);

  // Don't render if not authenticated
  if (!authLoading && !session) {
    return null;
  }

  return (
    <div className="w-full bg-soft-bg min-h-screen">
      <RefactoredPromptsContent
        prompts={prompts}
        isLoading={isLoading}
        error={error}
        filters={filters}
        onReload={loadPrompts}
      />
      <FloatingAddPromptButton reloadPrompts={loadPrompts} />
    </div>
  );
}
