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

  const signupSchema = z.object({
    firstName: z.string()
      .min(2, t('validation.firstNameMin'))
      .max(50, t('validation.firstNameMax'))
      .regex(/^[a-zA-Z\s\u0600-\u06FF\u0750-\u077F]+$/, t('validation.firstNameInvalid')),
    lastName: z.string()
      .min(2, t('validation.lastNameMin'))
      .max(50, t('validation.lastNameMax'))
      .regex(/^[a-zA-Z\s\u0600-\u06FF\u0750-\u077F]+$/, t('validation.lastNameInvalid')),
    username: z.string()
      .min(3, t('validation.usernameMin'))
      .max(20, t('validation.usernameMax'))
      .regex(/^[a-zA-Z0-9_-]+$/, t('validation.usernameInvalid'))
      .refine((val) => !val.startsWith('@'), t('validation.usernameNoAt'))
      .refine((val) => {
        const reserved = ['admin', 'administrator', 'root', 'system', 'superadmin', 'support', 'help', 'info', 'contact', 'jojo', 'jojoprompts', 'moderator', 'mod'];
        return !reserved.includes(val.toLowerCase());
      }, t('validation.usernameReserved')),
    email: z.string()
      .email(t('validation.invalidEmail'))
      .refine((email) => {
        const domain = email.split('@')[1]?.toLowerCase();
        const blocked = ['.local', '.test', '.invalid', '.localhost', '.example'];
        return !blocked.some(b => domain?.endsWith(b) || domain === b.substring(1));
      }, t('validation.emailDomainBlocked')),
    password: z.string().min(8, t('validation.passwordMin')),
    confirmPassword: z.string(),
    role: z.enum(VALID_ROLES as [UserRole, ...UserRole[]]).optional(),
  }).refine((data) => data.password === data.confirmPassword, {
    message: t('validation.passwordsDontMatch'),
    path: ["confirmPassword"],
  });

  const checkoutSignupSchema = z.object({
    firstName: z.string()
      .min(2, t('validation.firstNameMin'))
      .max(50, t('validation.firstNameMax'))
      .regex(/^[a-zA-Z\s\u0600-\u06FF\u0750-\u077F]+$/, t('validation.firstNameInvalid')),
    lastName: z.string()
      .min(2, t('validation.lastNameMin'))
      .max(50, t('validation.lastNameMax'))
      .regex(/^[a-zA-Z\s\u0600-\u06FF\u0750-\u077F]+$/, t('validation.lastNameInvalid')),
    email: z.string()
      .email(t('validation.invalidEmail'))
      .refine((email) => {
        const domain = email.split('@')[1]?.toLowerCase();
        const blocked = ['.local', '.test', '.invalid', '.localhost', '.example'];
        return !blocked.some(b => domain?.endsWith(b) || domain === b.substring(1));
      }, t('validation.emailDomainBlocked')),
    password: z.string().min(8, t('validation.passwordMin')),
    confirmPassword: z.string(),
  }).refine((data) => data.password === data.confirmPassword, {
    message: t('validation.passwordsDontMatch'),
    path: ["confirmPassword"],
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
