/**
 * Main service index - exports all services for easy import
 */

export { BaseService } from './BaseService';
export { userService } from './UserService';
export { paymentService } from './PaymentService'; 
export { promptService } from './PromptService';

// Re-export common types for convenience
export type {
  QueryOptions,
  InsertOptions,
  UpdateOptions
} from './BaseService';

export type {
  AuthCredentials,
  SignUpData,
  ProfileUpdateData
} from './UserService';

export type {
  PaymentData,
  PaymentVerificationParams
} from './PaymentService';

export type {
  CreatePromptData,
  UpdatePromptData,
  PromptSearchOptions
} from './PromptService';