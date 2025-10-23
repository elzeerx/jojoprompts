/**
 * Subscription and Access Control Helpers
 * 
 * Utilities for checking user subscription tiers and feature access
 */

export interface UserProfile {
  id: string;
  role?: string;
  membership_tier?: string | null;
}

/**
 * Check if user can download prompt attachments
 * Only admins, jadmins, and lifetime members have access
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
 */
export function getAttachmentAccessMessage(canAccess: boolean): string {
  if (canAccess) {
    return 'You have access to download attachments';
  }
  return 'Upgrade to Lifetime Plan to download attachments';
}

/**
 * Check if user can upload prompts
 */
export function canUploadPrompts(profile: UserProfile | null): boolean {
  if (!profile) return false;

  return ['admin', 'jadmin', 'prompter'].includes(profile.role || '');
}

/**
 * Check if user can manage prompts (create, edit, delete)
 */
export function canManagePrompts(profile: UserProfile | null): boolean {
  if (!profile) return false;

  return ['admin', 'jadmin', 'prompter'].includes(profile.role || '');
}
