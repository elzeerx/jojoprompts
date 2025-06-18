
// Enhanced utility functions for plan access management with security improvements
import { logWarn, logError } from './secureLogging';

export function getSubscriptionTier(planName: string | null | undefined): string {
  if (!planName) return 'none';
  
  const name = planName.toLowerCase().trim();
  
  // Enhanced plan name matching with security logging
  if (name.includes('ultimate') || name === 'ultimate plan' || name === '$100 plan') {
    return 'ultimate';
  }
  if (name.includes('premium') || name === 'premium plan' || name === '$80 plan') {
    return 'premium';
  }
  if (name.includes('standard') || name === 'standard plan') {
    return 'standard';
  }
  if (name.includes('basic') || name === 'basic plan') {
    return 'basic';
  }
  
  // Log unrecognized plans for security monitoring
  if (name && name !== 'none') {
    logWarn('Unrecognized subscription plan name', 'security', { planName: name });
  }
  
  return 'none';
}

export function isPromptLocked(
  promptType: string,
  userTier: string,
  isAdmin: boolean = false
): boolean {
  // Admins have access to everything
  if (isAdmin) return false;
  
  // Input validation
  if (!promptType || typeof promptType !== 'string') {
    logWarn('Invalid prompt type provided', 'security', { promptType });
    return true; // Default to locked for invalid input
  }
  
  // Define access levels for each tier with enhanced security
  const accessLevels = {
    none: [],
    basic: ['text'], // Only ChatGPT prompts
    standard: ['text', 'image'], // ChatGPT + Midjourney
    premium: ['text', 'image', 'workflow'], // All standard prompt types
    ultimate: ['text', 'image', 'workflow', 'special'] // All prompt types + special requests
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
  
  // If no plan required, it's free for everyone
  if (!categoryRequiredPlan) return false;
  
  // Input validation with security logging
  if (typeof userTier !== 'string' || typeof categoryRequiredPlan !== 'string') {
    logWarn('Invalid tier or category plan type', 'security', { 
      userTier: typeof userTier, 
      categoryRequiredPlan: typeof categoryRequiredPlan 
    });
    return true; // Default to locked for invalid input
  }
  
  // Enhanced tier hierarchy with proper security mapping
  const tierHierarchy = {
    'none': 0,
    'basic': 1,
    'standard': 2,
    'premium': 3,
    'ultimate': 4
  };
  
  const userTierLevel = tierHierarchy[userTier.toLowerCase() as keyof typeof tierHierarchy] || 0;
  const requiredTierLevel = tierHierarchy[categoryRequiredPlan.toLowerCase() as keyof typeof tierHierarchy] || 0;
  
  // Enhanced access control: user has access if their tier level is >= required tier level
  const hasAccess = userTierLevel >= requiredTierLevel;
  
  // Security logging for access attempts
  if (!hasAccess && userTier !== 'none') {
    logWarn('Category access denied', 'security', { 
      userTier, 
      requiredPlan: categoryRequiredPlan,
      userLevel: userTierLevel,
      requiredLevel: requiredTierLevel
    });
  }
  
  return !hasAccess;
}

export function hasFeatureAccess(
  feature: string,
  userTier: string,
  isAdmin: boolean = false
): boolean {
  // Admins have access to everything
  if (isAdmin) return true;
  
  // Input validation
  if (!feature || typeof feature !== 'string' || !userTier || typeof userTier !== 'string') {
    logWarn('Invalid feature or tier provided', 'security', { feature, userTier });
    return false; // Default to no access for invalid input
  }
  
  // Enhanced feature access mapping with security considerations
  const featureAccess = {
    none: [],
    basic: ['basic_prompts'],
    standard: ['basic_prompts', 'midjourney_prompts'],
    premium: ['basic_prompts', 'midjourney_prompts', 'workflow_prompts', 'advanced_features'],
    ultimate: ['basic_prompts', 'midjourney_prompts', 'workflow_prompts', 'advanced_features', 'special_requests']
  };
  
  const userFeatures = featureAccess[userTier.toLowerCase() as keyof typeof featureAccess] || [];
  const hasAccess = userFeatures.includes(feature);
  
  // Security logging for denied access attempts
  if (!hasAccess && userTier !== 'none') {
    logWarn('Feature access denied', 'security', { feature, userTier });
  }
  
  return hasAccess;
}

export function isAccessExpired(endDate: string | null | undefined): boolean {
  if (!endDate) return false; // Assume lifetime or active access if no end date
  
  try {
    const now = new Date();
    const expiration = new Date(endDate);
    
    // Validate date
    if (isNaN(expiration.getTime())) {
      logWarn('Invalid expiration date format', 'security', { endDate });
      return true; // Default to expired for invalid dates
    }
    
    return now > expiration;
  } catch (error) {
    logError('Error checking access expiration', 'security', { error: String(error), endDate });
    return true; // Default to expired on error
  }
}

export function getAccessStatus(endDate: string | null | undefined, isLifetime: boolean = false): string {
  if (isLifetime || !endDate) return 'lifetime';
  
  try {
    const now = new Date();
    const expiration = new Date(endDate);
    
    // Validate date
    if (isNaN(expiration.getTime())) {
      logWarn('Invalid expiration date in access status check', 'security', { endDate });
      return 'expired';
    }
    
    const daysLeft = Math.ceil((expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysLeft < 0) return 'expired';
    if (daysLeft <= 30) return 'expiring_soon';
    
    return 'active';
  } catch (error) {
    logError('Error getting access status', 'security', { error: String(error), endDate });
    return 'expired';
  }
}

export function formatAccessDuration(endDate: string | null | undefined, isLifetime: boolean = false): string {
  if (isLifetime || !endDate) return 'Lifetime Access';
  
  try {
    const now = new Date();
    const expiration = new Date(endDate);
    
    // Validate date
    if (isNaN(expiration.getTime())) {
      logWarn('Invalid expiration date in duration formatting', 'security', { endDate });
      return 'Access Expired';
    }
    
    const daysLeft = Math.ceil((expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysLeft < 0) return 'Access Expired';
    if (daysLeft === 0) return 'Expires Today';
    if (daysLeft === 1) return 'Expires Tomorrow';
    if (daysLeft <= 30) return `${daysLeft} days left`;
    
    return `Access until ${expiration.toLocaleDateString()}`;
  } catch (error) {
    logError('Error formatting access duration', 'security', { error: String(error), endDate });
    return 'Access Expired';
  }
}

// New security utility functions
export function validateSubscriptionData(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data || typeof data !== 'object') {
    errors.push('Invalid subscription data format');
    return { isValid: false, errors };
  }
  
  if (data.planId && typeof data.planId !== 'string') {
    errors.push('Invalid plan ID format');
  }
  
  if (data.userId && typeof data.userId !== 'string') {
    errors.push('Invalid user ID format');
  }
  
  if (data.amount && (typeof data.amount !== 'number' || data.amount <= 0)) {
    errors.push('Invalid amount value');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export function sanitizeSubscriptionInput(input: any): any {
  if (!input || typeof input !== 'object') {
    return {};
  }
  
  const sanitized: any = {};
  
  // Only allow specific fields to prevent injection
  const allowedFields = ['planId', 'userId', 'amount', 'paymentMethod'];
  
  for (const field of allowedFields) {
    if (input[field] !== undefined) {
      if (typeof input[field] === 'string') {
        sanitized[field] = input[field].trim().slice(0, 255); // Limit string length
      } else if (typeof input[field] === 'number' && !isNaN(input[field])) {
        sanitized[field] = input[field];
      }
    }
  }
  
  return sanitized;
}
