import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { createLogger } from '@/utils/logging';

const logger = createLogger('USERS_WITHOUT_PLANS');

interface UserWithoutPlan {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  created_at: string;
  email?: string;
}

export function useUsersWithoutPlans() {
  const [users, setUsers] = useState<UserWithoutPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsersWithoutPlans = async () => {
    // RETIRED (source-only, 2026-07-28): `get-users-without-plans` is
    // a 410 stub. V2 has no subscription concept. The only importer of
    // this hook (`MarketingEmailsPanel` -> `MarketingPage`) is not
    // referenced by `adminSectionElements.tsx` — the marketing surface
    // was removed from Admin V2.
    setLoading(true);
    setError(null);
    logger.warn('get-users-without-plans is retired; hook returns empty set');
    setUsers([]);
    setError(null);
    setLoading(false);
  };


  useEffect(() => {
    fetchUsersWithoutPlans();
  }, []);

  return {
    users,
    loading,
    error,
    refetch: fetchUsersWithoutPlans,
  };
}