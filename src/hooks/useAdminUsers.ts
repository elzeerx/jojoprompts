import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ExtendedUserProfile } from "@/types/user";
import { createLogger } from '@/utils/logging';

const logger = createLogger('ADMIN_USERS');

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

      // Call get-all-users edge function using GET with query params
      const { data: response, error: functionError } = await supabase.functions.invoke(
        'get-all-users?page=1&limit=10000'
      );

      if (functionError) throw functionError;
      if (!response?.users) throw new Error('Failed to fetch users');
      
      // Transform response data to AdminUser format
      const transformedUsers: AdminUser[] = (response.users || []).map((user: any) => ({
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        email: user.email,
        role: user.role,
        avatar_url: user.avatar_url,
        bio: user.bio,
        country: user.country,
        phone_number: user.phone_number,
        timezone: user.timezone,
        membership_tier: user.membership_tier,
        social_links: user.social_links,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        updated_at: user.auth_updated_at || user.updated_at,
        is_email_confirmed: user.is_email_confirmed || false,
        
        // Build subscription object if subscription data exists
        subscription: user.subscription ? {
          plan_name: user.subscription.plan_name,
          status: user.subscription.status,
          is_lifetime: user.subscription.is_lifetime || false,
          price_usd: user.subscription.price_usd || 0
        } : null
      }));

      logger.info('Loaded users successfully', { count: transformedUsers.length });
      setUsers(transformedUsers);
    } catch (err: any) {
      logger.error('Failed to load users', { error: err.message || err });
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
