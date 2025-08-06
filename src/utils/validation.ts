// Simplified validation utilities - replaces the over-engineered class-based system

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedValue?: any;
}

// Email validation
export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];
  
  if (!email || typeof email !== 'string') {
    return { isValid: false, errors: ['Email is required'], sanitizedValue: '' };
  }

  const sanitized = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(sanitized)) {
    errors.push('Please enter a valid email address');
  }
  
  if (sanitized.length > 320) {
    errors.push('Email address is too long');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: sanitized
  };
}

// Password validation
export function validatePassword(password: string): ValidationResult {
  const errors: string[] = [];
  
  if (!password || typeof password !== 'string') {
    return { isValid: false, errors: ['Password is required'] };
  }

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: password
  };
}

// Text validation
export function validateText(
  input: string, 
  fieldName: string, 
  options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    allowedChars?: RegExp;
  } = {}
): ValidationResult {
  const { required = true, minLength = 0, maxLength = 1000, allowedChars } = options;
  const errors: string[] = [];
  
  if (!input || typeof input !== 'string') {
    if (required) {
      errors.push(`${fieldName} is required`);
    }
    return { isValid: !required, errors, sanitizedValue: '' };
  }

  const sanitized = input.trim();
  
  if (required && sanitized.length === 0) {
    errors.push(`${fieldName} is required`);
  }
  
  if (sanitized.length < minLength) {
    errors.push(`${fieldName} must be at least ${minLength} characters long`);
  }
  
  if (sanitized.length > maxLength) {
    errors.push(`${fieldName} must be less than ${maxLength} characters long`);
  }
  
  if (allowedChars && !allowedChars.test(sanitized)) {
    errors.push(`${fieldName} contains invalid characters`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: sanitized
  };
}

// UUID validation
export function validateUUID(uuid: string, fieldName: string = 'ID'): ValidationResult {
  const errors: string[] = [];
  
  if (!uuid || typeof uuid !== 'string') {
    return { isValid: false, errors: [`${fieldName} is required`] };
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  if (!uuidRegex.test(uuid)) {
    errors.push(`${fieldName} must be a valid UUID`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: uuid.toLowerCase()
  };
}

// Number validation
export function validateNumber(
  value: any, 
  fieldName: string,
  options: {
    required?: boolean;
    min?: number;
    max?: number;
    integer?: boolean;
  } = {}
): ValidationResult {
  const { required = true, min, max, integer = false } = options;
  const errors: string[] = [];
  
  if (value === undefined || value === null || value === '') {
    if (required) {
      errors.push(`${fieldName} is required`);
    }
    return { isValid: !required, errors };
  }

  const num = Number(value);
  
  if (isNaN(num)) {
    errors.push(`${fieldName} must be a valid number`);
    return { isValid: false, errors };
  }
  
  if (integer && !Number.isInteger(num)) {
    errors.push(`${fieldName} must be a whole number`);
  }
  
  if (min !== undefined && num < min) {
    errors.push(`${fieldName} must be at least ${min}`);
  }
  
  if (max !== undefined && num > max) {
    errors.push(`${fieldName} must be no more than ${max}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: num
  };
}

// File validation
export function validateFile(
  file: File,
  options: {
    allowedTypes: string[];
    maxSizeMB: number;
    required?: boolean;
  }
): ValidationResult {
  const { allowedTypes, maxSizeMB, required = true } = options;
  const errors: string[] = [];
  
  if (!file) {
    if (required) {
      errors.push('File is required');
    }
    return { isValid: !required, errors };
  }
  
  if (!allowedTypes.includes(file.type)) {
    errors.push(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`);
  }
  
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    errors.push(`File size must be less than ${maxSizeMB}MB`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: file
  };
}