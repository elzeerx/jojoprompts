/**
 * Secure Profile Access Utilities
 * 
 * This module provides secure functions for accessing user profile data
 * with proper authorization and audit logging.
 */

import { supabase } from "@/integrations/supabase/client";

interface SecureProfileResult {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  role: string;
  avatar_url: string | null;
  bio: string | null;
  country: string | null;
  membership_tier: string;
  created_at: string;
  // Sensitive fields - only populated if user has proper access
  phone_number: string | null;
  social_links: Record<string, any>;
}

/**
 * Securely get a user profile with proper access controls and audit logging
 * This function uses the secure RPC function that handles sensitive data access
 */
export async function getSecureUserProfile(userId: string): Promise<SecureProfileResult | null> {
  try {
    const { data, error } = await supabase.rpc('get_user_profile_safe', {
      user_id_param: userId
    });

    if (error) {
      console.error('Error getting secure user profile:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    return data[0] as SecureProfileResult;
  } catch (error) {
    console.error('Exception getting secure user profile:', error);
    return null;
  }
}

/**
 * Check if the current user can access sensitive profile data
 * This includes audit logging for admin access
 */
export async function canAccessSensitiveData(targetUserId?: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('can_access_sensitive_profile_data', {
      target_user_id: targetUserId || null
    });

    return !error && data === true;
  } catch (error) {
    console.error('Error checking sensitive data access:', error);
    return false;
  }
}

/**
 * Verify if the current user is an admin with proper audit logging
 */
export async function isVerifiedAdmin(actionContext: string = 'general'): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_verified_admin', {
      action_context: actionContext
    });

    return !error && data === true;
  } catch (error) {
    console.error('Error verifying admin status:', error);
    return false;
  }
}

/**
 * Security utility to safely display sensitive information
 * Returns masked version if user doesn't have access
 */
export function maskSensitiveData(data: string | null, hasAccess: boolean, maskChar: string = '*'): string {
  if (!data || hasAccess) {
    return data || '';
  }
  
  // Mask sensitive data while preserving some structure
  if (data.includes('@')) {
    // Email-like data
    const [local, domain] = data.split('@');
    return `${local.charAt(0)}${maskChar.repeat(Math.max(1, local.length - 2))}${local.charAt(local.length - 1)}@${domain}`;
  } else if (data.match(/^\+?\d+$/)) {
    // Phone number-like data
    return `${data.substring(0, 2)}${maskChar.repeat(Math.max(1, data.length - 4))}${data.slice(-2)}`;
  } else {
    // Generic sensitive text
    return `${data.charAt(0)}${maskChar.repeat(Math.max(1, data.length - 2))}${data.charAt(data.length - 1)}`;
  }
}

/**
 * Error handler for security-related errors
 */
export function handleSecurityError(error: any, context: string): void {
  console.error(`Security error in ${context}:`, error);
  
  // Log to admin audit if possible (fire and forget)
  if (typeof error === 'object' && error.message) {
    // Use setTimeout to avoid blocking and handle errors silently
    setTimeout(async () => {
      try {
        await supabase.rpc('is_verified_admin', {
          action_context: `security_error_${context}`
        });
      } catch {
        // Silently ignore errors in error handling
      }
    }, 0);
  }
}