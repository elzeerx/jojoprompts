
// Predefined validation schemas
import { ValidationSchema } from './types.ts';

export class ValidationSchemas {
  static readonly USER_CREATE: ValidationSchema = {
    email: { required: true, type: 'email' },
    firstName: { 
      required: true, 
      type: 'string', 
      minLength: 2, 
      maxLength: 50, 
      sanitize: true 
    },
    lastName: { 
      required: true, 
      type: 'string', 
      minLength: 2, 
      maxLength: 50, 
      sanitize: true 
    },
    role: { 
      required: false, 
      type: 'string', 
      allowedValues: ['user', 'admin', 'jadmin', 'prompter'] 
    }
  };

  static readonly USER_UPDATE: ValidationSchema = {
    userId: { required: true, type: 'uuid' },
    email: { required: false, type: 'email' },
    firstName: { 
      required: false, 
      type: 'string', 
      minLength: 2, 
      maxLength: 50, 
      sanitize: true 
    },
    lastName: { 
      required: false, 
      type: 'string', 
      minLength: 2, 
      maxLength: 50, 
      sanitize: true 
    },
    username: {
      required: false,
      type: 'string',
      minLength: 3,
      maxLength: 30,
      pattern: /^[a-zA-Z0-9_-]+$/,
      sanitize: true
    },
    role: { 
      required: false, 
      type: 'string', 
      allowedValues: ['user', 'admin', 'jadmin', 'prompter'] 
    },
    bio: {
      required: false,
      type: 'string',
      maxLength: 500,
      sanitize: true
    },
    avatarUrl: {
      required: false,
      type: 'url'
    },
    country: {
      required: false,
      type: 'string',
      minLength: 2,
      maxLength: 100,
      sanitize: true
    },
    phoneNumber: {
      required: false,
      type: 'string',
      pattern: /^\+?[1-9]\d{1,14}$/,
      maxLength: 20
    },
    timezone: {
      required: false,
      type: 'string',
      maxLength: 50,
      sanitize: true
    },
    membershipTier: {
      required: false,
      type: 'string',
      allowedValues: ['free', 'basic', 'premium', 'enterprise'],
      sanitize: true
    },
    accountStatus: {
      required: false,
      type: 'string',
      allowedValues: ['enabled', 'disabled'],
      sanitize: true
    },
    emailConfirmed: {
      required: false,
      type: 'boolean'
    },
    socialLinks: {
      required: false,
      type: 'object'
    }
  };

  static readonly USER_DELETE: ValidationSchema = {
    userId: { required: true, type: 'uuid' }
  };

  static readonly PAYMENT_REQUEST: ValidationSchema = {
    userId: { required: true, type: 'uuid' },
    planId: { required: true, type: 'uuid' },
    amount: { required: true, type: 'number' },
    paymentMethod: { 
      required: true, 
      type: 'string', 
      allowedValues: ['paypal', 'stripe', 'admin_assigned'],
      maxLength: 50
    }
  };
}
