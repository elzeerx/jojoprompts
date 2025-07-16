// Apple email domains that require special handling
const APPLE_DOMAINS = ['icloud.com', 'mac.com', 'me.com', 'privaterelay.appleid.com'];

/**
 * Check if an email address is from an Apple domain
 * @param email - The email address to check
 * @returns true if the email is from an Apple domain
 */
export function isAppleEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  return APPLE_DOMAINS.includes(domain) || domain.endsWith('.privaterelay.appleid.com');
}

/**
 * Get the domain type for an email address
 * @param email - The email address to check
 * @returns The domain type (apple, gmail, outlook, other)
 */
export function getDomainType(email: string): 'apple' | 'gmail' | 'outlook' | 'other' {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return 'other';
  
  if (isAppleEmail(email)) return 'apple';
  if (domain === 'gmail.com') return 'gmail';
  if (domain === 'outlook.com' || domain === 'hotmail.com' || domain === 'live.com') return 'outlook';
  return 'other';
}

/**
 * Get special instructions for different email domains
 * @param email - The email address to check
 * @returns Special instructions for the email domain, or null if none needed
 */
export function getEmailDomainInstructions(email: string): string | null {
  const domainType = getDomainType(email);
  
  switch (domainType) {
    case 'apple':
      return 'Please add noreply@noreply.jojoprompts.com to your contacts to ensure email delivery.';
    case 'gmail':
      return 'Check your Promotions tab if you don\'t see our email in your inbox.';
    case 'outlook':
      return 'Check your Junk folder if you don\'t see our email in your inbox.';
    default:
      return null;
  }
}