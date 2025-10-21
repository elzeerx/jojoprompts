import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ExtendedUserProfile } from "@/types/user";

// AdminUser extends ExtendedUserProfile with subscription data
export interface AdminUser extends ExtendedUserProfile {
  subscription?: {
    plan_name: string;
    status: string;
    is_lifetime: boolean;
    price_usd: number;
  } | null;
}

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await (supabase as any)
        .from('v_admin_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers((data as AdminUser[]) || []);
    } catch (err: any) {
      console.error('[ADMIN_USERS_ERROR]', err);
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return { users, loading, error, refetch: fetchUsers };
}
