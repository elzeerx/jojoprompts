// Legacy auth handlers - now using shared adminAuth
// This file is kept for backward compatibility but should use shared version
export { 
  verifyAdmin, 
  validateAdminRequest, 
  hasPermission,
  logSecurityEvent 
} from "../_shared/adminAuth.ts";

// Re-export types for compatibility
export type { AuthContext } from "../_shared/adminAuth.ts";