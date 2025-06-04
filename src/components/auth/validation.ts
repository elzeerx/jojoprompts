
import { SecurityUtils } from "@/utils/security";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

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
