import { z } from "zod";
import { VALID_ROLES, UserRole } from "@/utils/roleValidation";

/**
 * Dynamic validation schemas that use translation keys
 * These factories allow validation messages to be bilingual
 */

export interface ValidationMessage {
  en: string;
  ar: string;
}

// Helper to create localized schema
export function createLocalizedSchemas(t: (key: string) => string) {
  
  const loginSchema = z.object({
    email: z.string().email(t('validation.invalidEmail')),
    password: z.string().min(1, t('validation.passwordRequired')),
  });

  const magicLinkSchema = z.object({
    email: z.string().email(t('validation.invalidEmail')),
  });

  // Simplified signup schema - 3 fields only
  const signupSchema = z.object({
    fullName: z.string()
      .min(2, t('validation.fullNameMin'))
      .max(100, t('validation.fullNameMax'))
      .regex(/^[a-zA-Z\s\u0600-\u06FF\u0750-\u077F]+$/, t('validation.fullNameInvalid')),
    email: z.string()
      .email(t('validation.invalidEmail'))
      .refine((email) => {
        const domain = email.split('@')[1]?.toLowerCase();
        const blocked = ['.local', '.test', '.invalid', '.localhost', '.example'];
        return !blocked.some(b => domain?.endsWith(b) || domain === b.substring(1));
      }, t('validation.emailDomainBlocked')),
    password: z.string().min(8, t('validation.passwordMin')),
    role: z.enum(VALID_ROLES as [UserRole, ...UserRole[]]).optional(),
  });

  // Checkout signup schema - same 3 fields
  const checkoutSignupSchema = z.object({
    fullName: z.string()
      .min(2, t('validation.fullNameMin'))
      .max(100, t('validation.fullNameMax'))
      .regex(/^[a-zA-Z\s\u0600-\u06FF\u0750-\u077F]+$/, t('validation.fullNameInvalid')),
    email: z.string()
      .email(t('validation.invalidEmail'))
      .refine((email) => {
        const domain = email.split('@')[1]?.toLowerCase();
        const blocked = ['.local', '.test', '.invalid', '.localhost', '.example'];
        return !blocked.some(b => domain?.endsWith(b) || domain === b.substring(1));
      }, t('validation.emailDomainBlocked')),
    password: z.string().min(8, t('validation.passwordMin')),
  });

  const forgotPasswordSchema = z.object({
    email: z.string().email(t('validation.invalidEmail')),
  });

  const resetPasswordSchema = z.object({
    password: z.string().min(8, t('validation.passwordMin')),
    confirmPassword: z.string(),
  }).refine((data) => data.password === data.confirmPassword, {
    message: t('validation.passwordsDontMatch'),
    path: ["confirmPassword"],
  });

  return {
    loginSchema,
    magicLinkSchema,
    signupSchema,
    checkoutSignupSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
  };
}

// Type exports
export type LoginFormValues = z.infer<ReturnType<typeof createLocalizedSchemas>['loginSchema']>;
export type MagicLinkFormValues = z.infer<ReturnType<typeof createLocalizedSchemas>['magicLinkSchema']>;
export type SignupFormValues = z.infer<ReturnType<typeof createLocalizedSchemas>['signupSchema']>;
export type CheckoutSignupFormValues = z.infer<ReturnType<typeof createLocalizedSchemas>['checkoutSignupSchema']>;
export type ForgotPasswordFormValues = z.infer<ReturnType<typeof createLocalizedSchemas>['forgotPasswordSchema']>;
export type ResetPasswordFormValues = z.infer<ReturnType<typeof createLocalizedSchemas>['resetPasswordSchema']>;
