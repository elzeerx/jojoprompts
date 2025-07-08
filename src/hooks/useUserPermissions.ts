import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useUserPermissions() {
  const { session, user } = useAuth();
  const [canManagePrompts, setCanManagePrompts] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkPermissions() {
      if (!user?.id) {
        setCanManagePrompts(false);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .rpc('can_manage_prompts', { _user_id: user.id });
        
        if (error) {
          console.error('Permission check error:', error);
          setCanManagePrompts(false);
        } else {
          setCanManagePrompts(data || false);
        }
      } catch (error) {
        console.error('Permission check failed:', error);
        setCanManagePrompts(false);
      } finally {
        setLoading(false);
      }
    }

    checkPermissions();
  }, [user?.id, session]);

  return { canManagePrompts, loading };
}