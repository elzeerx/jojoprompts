
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type UsageAction = 'view' | 'copy' | 'download' | 'favorite' | 'share';

export function useUsageTracking() {
  const { session } = useAuth();

  const trackUsage = async (
    promptId: string, 
    action: UsageAction, 
    metadata?: Record<string, any>
  ) => {
    if (!session) return;

    try {
      await supabase
        .from('prompt_usage_history')
        .insert({
          user_id: session.user.id,
          prompt_id: promptId,
          action_type: action,
          metadata: metadata || {}
        });
    } catch (error) {
      console.error('Error tracking usage:', error);
    }
  };

  const trackShare = async (
    promptId: string, 
    platform: string
  ) => {
    if (!session) return;

    try {
      await supabase
        .from('prompt_shares')
        .insert({
          prompt_id: promptId,
          shared_by: session.user.id,
          platform
        });
    } catch (error) {
      console.error('Error tracking share:', error);
    }
  };

  return { trackUsage, trackShare };
}
