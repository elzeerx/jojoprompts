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

      const { data, error } = await supabase
        .from('v_admin_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform view data to AdminUser format
      const transformedUsers: AdminUser[] = (data || []).map((row: any) => ({
        id: row.id,
        first_name: row.first_name,
        last_name: row.last_name,
        username: row.username,
        email: row.email,
        role: row.role,
        avatar_url: row.avatar_url,
        bio: row.bio,
        country: row.country,
        phone_number: row.phone_number,
        timezone: row.timezone,
        membership_tier: row.membership_tier,
        social_links: row.social_links,
        created_at: row.created_at,
        last_sign_in_at: row.last_sign_in_at,
        updated_at: row.updated_at,
        is_email_confirmed: row.is_email_confirmed,
        
        // Build subscription object if subscription data exists
        subscription: row.subscription_plan_name ? {
          plan_name: row.subscription_plan_name,
          status: row.subscription_status,
          is_lifetime: row.subscription_is_lifetime || false,
          price_usd: row.subscription_price_usd || 0
        } : null
      }));

      setUsers(transformedUsers);
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
