import { UserRole } from "@/types/user";
import { canViewField, isSuperAdmin } from "./fieldPermissions";

// Data masking utilities for sensitive information
export interface MaskingOptions {
  maskChar?: string;
  visibleStart?: number;
  visibleEnd?: number;
  fullMask?: boolean;
}

const DEFAULT_MASKING_OPTIONS: MaskingOptions = {
  maskChar: '*',
  visibleStart: 2,
  visibleEnd: 2,
  fullMask: false
};

// Mask sensitive data based on user role and permissions
export function maskSensitiveData(
  data: string | null | undefined,
  fieldName: string,
  userRole: UserRole,
  userId?: string,
  options: MaskingOptions = {}
): string {
  if (!data) return '';
  
  const opts = { ...DEFAULT_MASKING_OPTIONS, ...options };
  const isSuper = isSuperAdmin(userRole, userId);
  
  // Check if user can view this field
  if (!canViewField(userRole, fieldName, isSuper)) {
    return '[RESTRICTED]';
  }
  
  // Apply specific masking rules based on field type
  return applyFieldMasking(data, fieldName, userRole, isSuper, opts);
}

function applyFieldMasking(
  data: string,
  fieldName: string,
  userRole: UserRole,
  isSuper: boolean,
  options: MaskingOptions
): string {
  // Super admins see everything unmasked
  if (isSuper) {
    return data;
  }
  
  switch (fieldName) {
    case 'email':
      return maskEmail(data, userRole, options);
    
    case 'phone_number':
      return maskPhoneNumber(data, userRole, options);
    
    case 'social_links':
      return maskSocialLinks(data, userRole, options);
    
    case 'ip_address':
      return maskIpAddress(data, userRole, options);
    
    case 'user_agent':
      return maskUserAgent(data, userRole, options);
    
    // Sensitive personal information
    case 'bio':
      if (userRole === 'prompter') {
        return '[RESTRICTED]';
      }
      return data;
    
    default:
      return data;
  }
}

function maskEmail(email: string, userRole: UserRole, options: MaskingOptions): string {
  if (userRole === 'prompter') {
    return '[RESTRICTED]';
  }
  
  if (!email.includes('@')) return email;
  
  const [local, domain] = email.split('@');
  const { visibleStart = 2, visibleEnd = 1, maskChar = '*' } = options;
  
  if (local.length <= visibleStart + visibleEnd) {
    return `${maskChar.repeat(3)}@${domain}`;
  }
  
  const maskedLocal = 
    local.substring(0, visibleStart) +
    maskChar.repeat(Math.max(1, local.length - visibleStart - visibleEnd)) +
    local.substring(local.length - visibleEnd);
  
  return `${maskedLocal}@${domain}`;
}

function maskPhoneNumber(phone: string, userRole: UserRole, options: MaskingOptions): string {
  if (userRole === 'prompter' || userRole === 'jadmin') {
    return '[RESTRICTED]';
  }
  
  const { visibleStart = 3, visibleEnd = 2, maskChar = '*' } = options;
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length <= visibleStart + visibleEnd) {
    return maskChar.repeat(cleaned.length);
  }
  
  const masked = 
    phone.substring(0, visibleStart) +
    maskChar.repeat(Math.max(1, cleaned.length - visibleStart - visibleEnd)) +
    phone.substring(phone.length - visibleEnd);
  
  return masked;
}

function maskSocialLinks(socialLinks: string, userRole: UserRole, options: MaskingOptions): string {
  if (userRole === 'prompter') {
    return '[RESTRICTED]';
  }
  
  try {
    const links = JSON.parse(socialLinks);
    const maskedLinks: Record<string, string> = {};
    
    Object.entries(links).forEach(([platform, url]) => {
      if (typeof url === 'string') {
        maskedLinks[platform] = maskUrl(url, options);
      }
    });
    
    return JSON.stringify(maskedLinks);
  } catch {
    return socialLinks;
  }
}

function maskUrl(url: string, options: MaskingOptions): string {
  try {
    const urlObj = new URL(url);
    const { maskChar = '*' } = options;
    
    // Show domain but mask path and query parameters
    if (urlObj.pathname !== '/') {
      urlObj.pathname = '/' + maskChar.repeat(8);
    }
    
    urlObj.search = '';
    urlObj.hash = '';
    
    return urlObj.toString();
  } catch {
    return url;
  }
}

function maskIpAddress(ip: string, userRole: UserRole, options: MaskingOptions): string {
  if (userRole !== 'admin') {
    return '[RESTRICTED]';
  }
  
  const { maskChar = '*' } = options;
  const parts = ip.split('.');
  
  if (parts.length === 4) {
    // IPv4 - show first two octets
    return `${parts[0]}.${parts[1]}.${maskChar}.${maskChar}`;
  }
  
  // IPv6 or other format - mask most of it
  return ip.substring(0, 8) + maskChar.repeat(8);
}

function maskUserAgent(userAgent: string, userRole: UserRole, options: MaskingOptions): string {
  if (userRole !== 'admin') {
    return '[RESTRICTED]';
  }
  
  const { maskChar = '*' } = options;
  
  // Show browser name but mask version and other details
  const browserMatch = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)/i);
  const browser = browserMatch ? browserMatch[1] : 'Unknown';
  
  return `${browser} ${maskChar.repeat(20)}`;
}

// Utility to mask object fields
export function maskObjectFields<T extends Record<string, any>>(
  obj: T,
  userRole: UserRole,
  userId?: string,
  options: MaskingOptions = {}
): T {
  const masked = { ...obj } as any;
  
  Object.keys(masked).forEach(key => {
    if (typeof masked[key] === 'string') {
      masked[key] = maskSensitiveData(masked[key], key, userRole, userId, options);
    }
  });
  
  return masked;
}

// Check if field should be completely hidden (not just masked)
export function shouldHideField(fieldName: string, userRole: UserRole, userId?: string): boolean {
  const isSuper = isSuperAdmin(userRole, userId);
  return !canViewField(userRole, fieldName, isSuper);
}