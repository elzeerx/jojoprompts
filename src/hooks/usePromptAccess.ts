import { useAuth } from '@/contexts/AuthContext';
import { useUserSubscription } from '@/hooks/useUserSubscription';
import { getSubscriptionTier, isPromptLockedByContent } from '@/utils/subscription';
import type { PromptRow } from '@/types/prompts';

/**
 * Central hook for prompt access control
 * 
 * Access Tiers:
 * - $55 (Basic): ChatGPT prompts only (text + image)
 * - $65 (Standard): ChatGPT + ALL Midjourney prompts
 * - $80+ (Premium/Ultimate/Lifetime): Full access to everything
 */
export function usePromptAccess() {
  const { user, userRole, isAdmin } = useAuth();
  const { userSubscription } = useUserSubscription(user?.id);

  const userTier = getSubscriptionTier(userSubscription?.subscription_plans?.name);
  const isLifetime = userSubscription?.subscription_plans?.is_lifetime ?? false;
  const hasFullAccess = isAdmin || isLifetime || userTier === 'premium' || userTier === 'ultimate';

  /**
   * Check if a specific prompt is locked for the current user
   */
  const checkPromptAccess = (prompt: PromptRow): boolean => {
    // No user = locked (visitors)
    if (!user) return true;
    
    return isPromptLockedByContent(
      prompt.prompt_type || 'text',
      prompt.metadata?.category,
      prompt.metadata?.model_type,
      userTier,
      isAdmin,
      isLifetime
    );
  };

  /**
   * Filter out locked prompts from a list (useful for showing only accessible prompts)
   */
  const filterAccessiblePrompts = (prompts: PromptRow[]): PromptRow[] => {
    return prompts.filter(prompt => !checkPromptAccess(prompt));
  };

  return {
    user,
    userTier,
    isLifetime,
    isAdmin,
    hasFullAccess,
    checkPromptAccess,
    filterAccessiblePrompts,
    hasSubscription: !!userSubscription
  };
}
