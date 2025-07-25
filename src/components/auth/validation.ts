import { SecurityUtils } from "@/utils/security";
import { z } from "zod";
import { VALID_ROLES, UserRole } from "@/utils/roleValidation";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Zod schemas for form validation
export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const magicLinkSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

// Magic link signup schema - no password required
export const signupSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  username: z.string().min(3, "Username must be at least 3 characters").max(20, "Username must be less than 20 characters").regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  email: z.string().email("Please enter a valid email address"),
  role: z.enum(VALID_ROLES as [UserRole, ...UserRole[]]).optional(),
});

// Checkout-specific magic link signup schema - no password required
export const checkoutSignupSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Type inference from schemas
export type LoginFormValues = z.infer<typeof loginSchema>;
export type MagicLinkFormValues = z.infer<typeof magicLinkSchema>;
export type SignupFormValues = z.infer<typeof signupSchema>;
export type CheckoutSignupFormValues = z.infer<typeof checkoutSignupSchema>;
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export const validateEmail = (email: string): ValidationResult => {
  const errors: string[] = [];
  
  if (!email) {
    errors.push('Email is required');
  } else if (!SecurityUtils.isValidEmail(email)) {
    errors.push('Please enter a valid email address');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validatePassword = (password: string): ValidationResult => {
  const errors: string[] = [];
  
  if (!password) {
    errors.push('Password is required');
    return { isValid: false, errors };
  }
  
  const strengthCheck = SecurityUtils.isStrongPassword(password);
  return {
    isValid: strengthCheck.isValid,
    errors: strengthCheck.errors
  };
};

export const validateName = (name: string, fieldName: string): ValidationResult => {
  const errors: string[] = [];
  
  if (!name) {
    errors.push(`${fieldName} is required`);
  } else if (name.length < 2) {
    errors.push(`${fieldName} must be at least 2 characters long`);
  } else if (name.length > 50) {
    errors.push(`${fieldName} must be less than 50 characters`);
  } else if (!/^[a-zA-Z\s\u0600-\u06FF\u0750-\u077F]+$/.test(name)) {
    errors.push(`${fieldName} can only contain letters and spaces`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateConfirmPassword = (password: string, confirmPassword: string): ValidationResult => {
  const errors: string[] = [];
  
  if (!confirmPassword) {
    errors.push('Please confirm your password');
  } else if (password !== confirmPassword) {
    errors.push('Passwords do not match');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateUserRole = (role: string): ValidationResult => {
  const errors: string[] = [];
  
  if (!role) {
    errors.push('Role is required');
  } else if (!VALID_ROLES.includes(role as UserRole)) {
    errors.push(`Role must be one of: ${VALID_ROLES.join(', ')}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Sanitize form inputs to prevent XSS
export const sanitizeFormData = (data: Record<string, any>): Record<string, any> => {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      sanitized[key] = SecurityUtils.sanitizeUserInput(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};
