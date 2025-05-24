
// Utility functions for plan access management
export function getSubscriptionTier(planName: string | null | undefined): string {
  if (!planName) return 'none';
  
  const name = planName.toLowerCase();
  
  if (name.includes('basic')) return 'basic';
  if (name.includes('standard')) return 'standard';
  if (name.includes('premium')) return 'premium';
  if (name.includes('ultimate') || name.includes('lifetime')) return 'lifetime';
  
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
    lifetime: ['text', 'image', 'workflow'] // All prompt types (lifetime access)
  };
  
  const userAccess = accessLevels[userTier as keyof typeof accessLevels] || [];
  
  // Check if the prompt type is accessible
  return !userAccess.includes(promptType);
}

export function isCategoryLocked(
  category: string | null | undefined,
  userTier: string,
  isAdmin: boolean = false
): boolean {
  // Admins have access to everything
  if (isAdmin) return false;
  
  if (!category) return true; // Lock if no category is defined
  
  const categoryLower = category.toLowerCase();
  
  // Define category access for each tier
  const categoryAccess = {
    none: [],
    basic: ['chatgpt'], // Only ChatGPT prompts
    standard: ['chatgpt', 'midjourney'], // ChatGPT + Midjourney
    premium: ['chatgpt', 'midjourney', 'n8n', 'workflow'], // All categories
    lifetime: ['chatgpt', 'midjourney', 'n8n', 'workflow'] // All categories
  };
  
  const userAccess = categoryAccess[userTier as keyof typeof categoryAccess] || [];
  
  // Check if any of the user's accessible categories match the prompt's category
  return !userAccess.some(accessibleCategory => 
    categoryLower.includes(accessibleCategory) || 
    accessibleCategory.includes(categoryLower)
  );
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
    lifetime: ['basic_prompts', 'midjourney_prompts', 'workflow_prompts', 'advanced_features']
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
