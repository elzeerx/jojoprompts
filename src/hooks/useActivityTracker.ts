
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { secureLogger } from '@/utils/secureLogging';

export type ActivityType = 
  | 'page_view'
  | 'prompt_view'
  | 'prompt_copy'
  | 'prompt_download'
  | 'search_query'
  | 'favorite_add'
  | 'favorite_remove'
  | 'subscription_view'
  | 'payment_attempt'
  | 'admin_action'
  | 'error_occurred';

interface ActivityMetadata {
  prompt_id?: string;
  search_term?: string;
  page_path?: string;
  error_type?: string;
  subscription_plan?: string;
  [key: string]: any;
}

export function useActivityTracker() {
  const { user } = useAuth();

  const trackActivity = useCallback(async (
    actionType: ActivityType,
    metadata: ActivityMetadata = {}
  ) => {
    try {
      // Always log to secure logger for debugging
      secureLogger.log('info', `Activity: ${actionType}`, 'activity_tracker', {
        action_type: actionType,
        ...metadata
      }, user?.id);

      // Only save to database for authenticated users and specific actions
      if (user && shouldPersistActivity(actionType)) {
        const { error } = await supabase
          .from('prompt_usage_history')
          .insert({
            user_id: user.id,
            action_type: actionType,
            prompt_id: metadata.prompt_id || null,
            metadata: {
              timestamp: new Date().toISOString(),
              user_agent: navigator.userAgent,
              ...metadata
            }
          });

        if (error) {
          console.warn('Failed to track activity:', error);
        }
      }
    } catch (error) {
      console.warn('Activity tracking failed:', error);
    }
  }, [user]);

  return { trackActivity };
}

function shouldPersistActivity(actionType: ActivityType): boolean {
  // Only persist important activities to avoid database bloat
  const persistentActivities: ActivityType[] = [
    'prompt_copy',
    'prompt_download',
    'favorite_add',
    'favorite_remove',
    'payment_attempt',
    'admin_action'
  ];

  return persistentActivities.includes(actionType);
}
