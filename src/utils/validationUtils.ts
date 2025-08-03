// Common validation patterns for consistent form validation
export const VALIDATION_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
  USERNAME: /^[a-zA-Z0-9_-]{3,20}$/,
  PHONE: /^\+?[\d\s\-\(\)]{10,}$/,
  URL: /^https?:\/\/.+/,
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
} as const;

// Validation error messages
export const VALIDATION_MESSAGES = {
  REQUIRED: "This field is required",
  EMAIL: "Please enter a valid email address",
  PASSWORD: "Password must be at least 8 characters with uppercase, lowercase, and number",
  USERNAME: "Username must be 3-20 characters (letters, numbers, underscore, hyphen)",
  PHONE: "Please enter a valid phone number",
  URL: "Please enter a valid URL",
  MIN_LENGTH: (min: number) => `Must be at least ${min} characters`,
  MAX_LENGTH: (max: number) => `Must be no more than ${max} characters`,
  MIN_VALUE: (min: number) => `Must be at least ${min}`,
  MAX_VALUE: (max: number) => `Must be no more than ${max}`,
  MATCHES_PATTERN: (pattern: string) => `Must match the pattern: ${pattern}`,
  UNIQUE: "This value already exists",
  INVALID_FORMAT: "Invalid format"
} as const;

// Validation functions
export function validateRequired(value: any, fieldName: string = "Field"): string | null {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return VALIDATION_MESSAGES.REQUIRED;
  }
  return null;
}

export function validateEmail(email: string): string | null {
  if (!email) return VALIDATION_MESSAGES.REQUIRED;
  if (!VALIDATION_PATTERNS.EMAIL.test(email)) {
    return VALIDATION_MESSAGES.EMAIL;
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return VALIDATION_MESSAGES.REQUIRED;
  if (!VALIDATION_PATTERNS.PASSWORD.test(password)) {
    return VALIDATION_MESSAGES.PASSWORD;
  }
  return null;
}

export function validateLength(value: string, min: number, max?: number): string | null {
  if (!value) return VALIDATION_MESSAGES.REQUIRED;
  if (value.length < min) {
    return VALIDATION_MESSAGES.MIN_LENGTH(min);
  }
  if (max && value.length > max) {
    return VALIDATION_MESSAGES.MAX_LENGTH(max);
  }
  return null;
}

export function validateNumber(value: any, min?: number, max?: number): string | null {
  if (!value) return VALIDATION_MESSAGES.REQUIRED;
  const num = Number(value);
  if (isNaN(num)) return "Must be a valid number";
  if (min !== undefined && num < min) {
    return VALIDATION_MESSAGES.MIN_VALUE(min);
  }
  if (max !== undefined && num > max) {
    return VALIDATION_MESSAGES.MAX_VALUE(max);
  }
  return null;
}

export function validatePattern(value: string, pattern: RegExp, message?: string): string | null {
  if (!value) return VALIDATION_MESSAGES.REQUIRED;
  if (!pattern.test(value)) {
    return message || VALIDATION_MESSAGES.INVALID_FORMAT;
  }
  return null;
}

// Composite validation function
export function validateField(
  value: any,
  rules: {
    required?: boolean;
    email?: boolean;
    password?: boolean;
    minLength?: number;
    maxLength?: number;
    minValue?: number;
    maxValue?: number;
    pattern?: RegExp;
    patternMessage?: string;
  }
): string | null {
  const { required, email, password, minLength, maxLength, minValue, maxValue, pattern, patternMessage } = rules;

  // Required check
  if (required) {
    const requiredError = validateRequired(value);
    if (requiredError) return requiredError;
  }

  // Type-specific validations
  if (email && typeof value === 'string') {
    const emailError = validateEmail(value);
    if (emailError) return emailError;
  }

  if (password && typeof value === 'string') {
    const passwordError = validatePassword(value);
    if (passwordError) return passwordError;
  }

  if (typeof value === 'string') {
    if (minLength || maxLength) {
      const lengthError = validateLength(value, minLength || 0, maxLength);
      if (lengthError) return lengthError;
    }
  }

  if (typeof value === 'number' || !isNaN(Number(value))) {
    if (minValue !== undefined || maxValue !== undefined) {
      const numberError = validateNumber(value, minValue, maxValue);
      if (numberError) return numberError;
    }
  }

  if (pattern && typeof value === 'string') {
    const patternError = validatePattern(value, pattern, patternMessage);
    if (patternError) return patternError;
  }

  return null;
}

// Form validation helper
export function validateForm(
  formData: Record<string, any>,
  validationRules: Record<string, any>
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const [fieldName, rules] of Object.entries(validationRules)) {
    const value = formData[fieldName];
    const error = validateField(value, rules);
    if (error) {
      errors[fieldName] = error;
    }
  }

  return errors;
} 