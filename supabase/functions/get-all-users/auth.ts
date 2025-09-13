// Legacy auth handlers - now using shared adminAuth
// This file is kept for backward compatibility but should use shared version
export { 
  validateAdminRequest, 
  hasPermission,
  logSecurityEvent 
} from "../_shared/adminAuth.ts";
export { verifyAdmin } from "./auth/adminVerifier.ts";

// Re-export types for compatibility
export type { AuthContext } from "../_shared/adminAuth.ts";