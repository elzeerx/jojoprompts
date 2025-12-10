/**
 * Subscription and Access Control Helpers
 * 
 * Utilities for checking user subscription tiers and feature access.
 * These functions determine what features users can access based on their
 * role and membership tier.
 */

export interface UserProfile {
  id: string;
  role?: string;
  membership_tier?: string | null;
}

/**
 * Check if user can download prompt attachments
 * 
 * File download access is restricted to:
 * - Admins (full access)
 * - Jadmins (full access)
 * - Lifetime members (premium feature)
 * 
 * @param profile - User profile object with role and membership_tier
 * @returns true if user has download access, false otherwise
 * 
 * @example
 * ```tsx
 * const canDownload = canDownloadAttachments(userProfile);
 * if (canDownload) {
 *   // Show download button
 * }
 * ```
 */
export function canDownloadAttachments(profile: UserProfile | null): boolean {
  if (!profile) return false;

  // Admins always have access
  if (profile.role === 'admin' || profile.role === 'jadmin') {
    return true;
  }

  // Check if user has lifetime membership
  return profile.membership_tier === 'lifetime';
}

/**
 * Get message explaining attachment access
 * 
 * @param canAccess - Whether user has access to attachments
 * @returns Descriptive message for UI display
 */
export function getAttachmentAccessMessage(canAccess: boolean): string {
  if (canAccess) {
    return 'You have access to download attachments';
  }
  return 'Upgrade to Lifetime Plan to download attachments';
}

/**
 * Check if user can upload prompts
 * 
 * Upload access is granted to:
 * - Admins
 * - Jadmins
 * - Prompters (content creators)
 * 
 * @param profile - User profile object
 * @returns true if user can upload prompts
 */
export function canUploadPrompts(profile: UserProfile | null): boolean {
  if (!profile) return false;

  return ['admin', 'jadmin', 'prompter'].includes(profile.role || '');
}

/**
 * Check if user can manage prompts (create, edit, delete)
 * 
 * Management access is granted to:
 * - Admins (full access)
 * - Jadmins (full access)
 * - Prompters (own prompts only)
 * 
 * @param profile - User profile object
 * @returns true if user has prompt management access
 */
export function canManagePrompts(profile: UserProfile | null): boolean {
  if (!profile) return false;

  return ['admin', 'jadmin', 'prompter'].includes(profile.role || '');
}
