
// Utility functions for subscription and access management
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
    lifetime: ['text', 'image', 'workflow'] // All prompt types (lifetime $80 plan)
  };
  
  const userAccess = accessLevels[userTier as keyof typeof accessLevels] || [];
  
  // Check if the prompt type is accessible
  return !userAccess.includes(promptType);
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
