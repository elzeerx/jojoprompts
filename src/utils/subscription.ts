
// Utility functions for plan access management
export function getSubscriptionTier(planName: string | null | undefined): string {
  if (!planName) return 'none';
  
  const name = planName.toLowerCase();
  
  if (name.includes('basic')) return 'basic';
  if (name.includes('standard')) return 'standard';
  if (name.includes('premium')) return 'premium';
  if (name.includes('ultimate')) return 'ultimate';
  
  return 'none';
}

export function isPromptLocked(
  promptType: string,
  userTier: string,
  isAdmin: boolean = false
): boolean {
  // Admins have access to everything
  if (isAdmin) return false;
  
  // Define access levels for each tier
  const accessLevels = {
    none: [],
    basic: ['text'], // Only ChatGPT prompts
    standard: ['text', 'image'], // ChatGPT + Midjourney
    premium: ['text', 'image', 'workflow'], // All prompt types
    ultimate: ['text', 'image', 'workflow'] // All prompt types + special requests
  };
  
  const userAccess = accessLevels[userTier as keyof typeof accessLevels] || [];
  
  // Check if the prompt type is accessible
  return !userAccess.includes(promptType);
}

export function isCategoryLocked(
  categoryRequiredPlan: string | null | undefined,
  userTier: string,
  isAdmin: boolean = false
): boolean {
  // Admins have access to everything
  if (isAdmin) return false;
  
  if (!categoryRequiredPlan) return false; // If no plan required, it's free
  
  // Define tier hierarchy (higher tiers include lower tier access)
  const tierHierarchy = {
    'basic': 1,
    'standard': 2,
    'premium': 3,
    'ultimate': 4
  };
  
  const userTierLevel = tierHierarchy[userTier as keyof typeof tierHierarchy] || 0;
  const requiredTierLevel = tierHierarchy[categoryRequiredPlan.toLowerCase() as keyof typeof tierHierarchy] || 0;
  
  // User has access if their tier level is >= required tier level
  return userTierLevel < requiredTierLevel;
}

export function hasFeatureAccess(
  feature: string,
  userTier: string,
  isAdmin: boolean = false
): boolean {
  // Admins have access to everything
  if (isAdmin) return true;
  
  // Define feature access for each tier
  const featureAccess = {
    none: [],
    basic: ['basic_prompts'],
    standard: ['basic_prompts', 'midjourney_prompts'],
    premium: ['basic_prompts', 'midjourney_prompts', 'workflow_prompts', 'advanced_features'],
    ultimate: ['basic_prompts', 'midjourney_prompts', 'workflow_prompts', 'advanced_features', 'special_requests']
  };
  
  const userFeatures = featureAccess[userTier as keyof typeof featureAccess] || [];
  
  return userFeatures.includes(feature);
}

export function isAccessExpired(endDate: string | null | undefined): boolean {
  if (!endDate) return false; // Assume lifetime or active access if no end date
  
  const now = new Date();
  const expiration = new Date(endDate);
  
  return now > expiration;
}

export function getAccessStatus(endDate: string | null | undefined, isLifetime: boolean = false): string {
  if (isLifetime || !endDate) return 'lifetime';
  
  const now = new Date();
  const expiration = new Date(endDate);
  const daysLeft = Math.ceil((expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= 30) return 'expiring_soon';
  
  return 'active';
}

export function formatAccessDuration(endDate: string | null | undefined, isLifetime: boolean = false): string {
  if (isLifetime || !endDate) return 'Lifetime Access';
  
  const now = new Date();
  const expiration = new Date(endDate);
  const daysLeft = Math.ceil((expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysLeft < 0) return 'Access Expired';
  if (daysLeft === 0) return 'Expires Today';
  if (daysLeft === 1) return 'Expires Tomorrow';
  if (daysLeft <= 30) return `${daysLeft} days left`;
  
  return `Access until ${expiration.toLocaleDateString()}`;
}
