import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ExtendedUserProfile, UserRole } from "@/types/user";
import { createLogger } from '@/utils/logging';

const logger = createLogger('ADMIN_USERS');

export interface AdminUser extends ExtendedUserProfile {
  account_disabled?: boolean;
  email_confirmed_at?: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function normalizeRole(value: unknown): UserRole {
  return value === "admin" ||
    value === "jadmin" ||
    value === "prompter" ||
    value === "user"
    ? value
    : "user";
}

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestGenerationRef = useRef(0);

  const fetchUsers = useCallback(async () => {
    const requestGeneration = ++requestGenerationRef.current;

    try {
      setLoading(true);
      setError(null);

      let allUsers: AdminUser[] = [];
      let page = 1;
      let hasMore = true;
      const batchSize = 100;

      // Fetch users in batches until all are loaded
      while (hasMore) {
        const { data: response, error: functionError } = await supabase.functions.invoke(
          "get-all-users",
          {
            body: {
              action: "list",
              page,
              limit: batchSize,
            },
          },
        );

        if (functionError) throw functionError;
        if (!Array.isArray(response?.users)) {
          throw new Error('Failed to fetch users');
        }
        
        // Transform response data to AdminUser format
        const transformedUsers: AdminUser[] = (response.users as unknown[])
          .flatMap((rawUser) => {
            if (!isRecord(rawUser) || typeof rawUser.id !== "string") return [];

            const socialLinks = isRecord(rawUser.social_links)
              ? Object.fromEntries(
                  Object.entries(rawUser.social_links).filter(
                    (entry): entry is [string, string] =>
                      typeof entry[1] === "string",
                  ),
                )
              : null;

            return [{
              id: rawUser.id,
              first_name: optionalString(rawUser.first_name) ?? "",
              last_name: optionalString(rawUser.last_name) ?? "",
              username: optionalString(rawUser.username) ?? "",
              email: optionalString(rawUser.email),
              role: normalizeRole(rawUser.role),
              avatar_url: nullableString(rawUser.avatar_url),
              bio: nullableString(rawUser.bio),
              country: nullableString(rawUser.country),
              phone_number: nullableString(rawUser.phone_number),
              timezone: nullableString(rawUser.timezone),
              membership_tier: nullableString(rawUser.membership_tier),
              social_links: socialLinks,
              created_at: nullableString(rawUser.created_at),
              last_sign_in_at: nullableString(rawUser.last_sign_in_at),
              updated_at:
                nullableString(rawUser.auth_updated_at) ??
                nullableString(rawUser.updated_at),
              is_email_confirmed:
                typeof rawUser.is_email_confirmed === "boolean"
                  ? rawUser.is_email_confirmed
                  : undefined,
              email_confirmed_at:
                nullableString(rawUser.email_confirmed_at),
              has_auth_account:
                typeof rawUser.has_auth_account === "boolean"
                  ? rawUser.has_auth_account
                  : undefined,
              account_disabled: rawUser.account_disabled === true,
            }];
          });

        allUsers = [...allUsers, ...transformedUsers];
        
        // Check if there are more pages
        hasMore = transformedUsers.length === batchSize;
        
        logger.info(`Fetched page ${page}`, { 
          pageUsers: transformedUsers.length, 
          totalLoaded: allUsers.length 
        });
        
        page++;
      }

      if (requestGeneration !== requestGenerationRef.current) return;

      logger.info('Loaded all users successfully', { count: allUsers.length });
      setError(null);
      setUsers(allUsers);
    } catch (err: unknown) {
      if (requestGeneration !== requestGenerationRef.current) return;

      const message = err instanceof Error ? err.message : "Failed to load users";
      logger.error('Failed to load users', { error: message });
      setError(message);
    } finally {
      if (requestGeneration === requestGenerationRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchUsers();

    return () => {
      requestGenerationRef.current += 1;
    };
  }, [fetchUsers]);

  return { users, loading, error, refetch: fetchUsers };
}
