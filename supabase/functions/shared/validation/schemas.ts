
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
    role: { 
      required: false, 
      type: 'string', 
      allowedValues: ['user', 'admin', 'jadmin', 'prompter'] 
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
