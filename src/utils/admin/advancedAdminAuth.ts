// Advanced admin authentication with time-based tokens and IP restrictions
import { supabase } from '@/integrations/supabase/client';
import { EnhancedSecurityLogger } from '@/utils/security/enhancedSecurityLogger';

export interface AdminAccessToken {
  id: string;
  adminUserId: string;
  tokenHash: string;
  operationType: string;
  ipAddress?: string;
  expiresAt: string;
  usedAt?: string;
  isValid: boolean;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface IPRestriction {
  id: string;
  adminUserId: string;
  allowedIpRanges: string[];
  restrictionType: 'whitelist' | 'blacklist';
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type SensitiveOperation = 
  | 'user_deletion'
  | 'data_export'
  | 'security_config'
  | 'system_maintenance'
  | 'bulk_operations'
  | 'sensitive_data_access';

export class AdvancedAdminAuth {
  private static readonly TOKEN_EXPIRY_MINUTES = 15;
  private static readonly MAX_FAILED_ATTEMPTS = 3;
  private static readonly LOCKOUT_DURATION_MINUTES = 30;

  /**
   * Generate time-based access token for sensitive operations
   */
  static async generateAccessToken(
    adminUserId: string,
    operationType: SensitiveOperation,
    metadata: Record<string, any> = {}
  ): Promise<{ token: string; expiresAt: string } | null> {
    try {
      // Verify IP restrictions first
      const ipAllowed = await this.validateIPRestrictions(adminUserId);
      if (!ipAllowed) {
        await EnhancedSecurityLogger.logAuthorizationFailure(
          'admin_ip_restriction_violation',
          operationType,
          { adminUserId, ipAddress: 'client-side' }
        );
        return null;
      }

      // Generate secure token
      const tokenBytes = new Uint8Array(32);
      crypto.getRandomValues(tokenBytes);
      const token = Array.from(tokenBytes, byte => byte.toString(16).padStart(2, '0')).join('');
      
      // Hash token for storage
      const encoder = new TextEncoder();
      const tokenBuffer = encoder.encode(token);
      const hashBuffer = await crypto.subtle.digest('SHA-256', tokenBuffer);
      const tokenHash = Array.from(new Uint8Array(hashBuffer), byte => 
        byte.toString(16).padStart(2, '0')
      ).join('');

      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + this.TOKEN_EXPIRY_MINUTES);

      // Store token in database
      const { error } = await supabase
        .from('admin_access_tokens')
        .insert({
          admin_user_id: adminUserId,
          token_hash: tokenHash,
          operation_type: operationType,
          ip_address: 'client-side', // Would need server-side for real IP
          expires_at: expiresAt.toISOString(),
          metadata
        });

      if (error) {
        await EnhancedSecurityLogger.logSystemEvent('admin_token_creation_error', 'high', {
          adminUserId,
          operationType,
          error: error.message
        });
        return null;
      }

      await EnhancedSecurityLogger.logSystemEvent('admin_access_token_generated', 'high', {
        adminUserId,
        operationType,
        expiresAt: expiresAt.toISOString()
      });

      return {
        token,
        expiresAt: expiresAt.toISOString()
      };
    } catch (error) {
      await EnhancedSecurityLogger.logSystemEvent('admin_token_generation_error', 'critical', {
        adminUserId,
        operationType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Validate and consume access token
   */
  static async validateAccessToken(
    token: string,
    operationType: SensitiveOperation,
    adminUserId: string
  ): Promise<boolean> {
    try {
      // Hash the provided token
      const encoder = new TextEncoder();
      const tokenBuffer = encoder.encode(token);
      const hashBuffer = await crypto.subtle.digest('SHA-256', tokenBuffer);
      const tokenHash = Array.from(new Uint8Array(hashBuffer), byte => 
        byte.toString(16).padStart(2, '0')
      ).join('');

      // Find and validate token
      const { data, error } = await supabase
        .from('admin_access_tokens')
        .select('*')
        .eq('admin_user_id', adminUserId)
        .eq('token_hash', tokenHash)
        .eq('operation_type', operationType)
        .eq('is_valid', true)
        .is('used_at', null)
        .single();

      if (error || !data) {
        await EnhancedSecurityLogger.logAuthorizationFailure(
          'admin_token_validation_failed',
          operationType,
          { adminUserId, tokenProvided: !!token }
        );
        return false;
      }

      // Check expiration
      const now = new Date();
      const expiresAt = new Date(data.expires_at);
      
      if (now > expiresAt) {
        await EnhancedSecurityLogger.logAuthorizationFailure(
          'admin_token_expired',
          operationType,
          { adminUserId, expiresAt: data.expires_at }
        );
        return false;
      }

      // Mark token as used
      const { error: updateError } = await supabase
        .from('admin_access_tokens')
        .update({
          used_at: now.toISOString(),
          is_valid: false
        })
        .eq('id', data.id);

      if (updateError) {
        await EnhancedSecurityLogger.logSystemEvent('admin_token_consumption_error', 'high', {
          adminUserId,
          tokenId: data.id,
          error: updateError.message
        });
        return false;
      }

      await EnhancedSecurityLogger.logSystemEvent('admin_access_token_validated', 'high', {
        adminUserId,
        operationType,
        tokenId: data.id
      });

      return true;
    } catch (error) {
      await EnhancedSecurityLogger.logSystemEvent('admin_token_validation_error', 'critical', {
        adminUserId,
        operationType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Set IP restrictions for admin user
   */
  static async setIPRestrictions(
    adminUserId: string,
    allowedIpRanges: string[],
    restrictionType: 'whitelist' | 'blacklist' = 'whitelist'
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('admin_ip_restrictions')
        .upsert({
          admin_user_id: adminUserId,
          allowed_ip_ranges: allowedIpRanges,
          restriction_type: restrictionType,
          is_active: true,
          created_by: adminUserId
        }, {
          onConflict: 'admin_user_id'
        });

      if (error) {
        await EnhancedSecurityLogger.logSystemEvent('admin_ip_restriction_error', 'high', {
          adminUserId,
          error: error.message
        });
        return false;
      }

      await EnhancedSecurityLogger.logSystemEvent('admin_ip_restrictions_set', 'high', {
        adminUserId,
        restrictionType,
        ipRangesCount: allowedIpRanges.length
      });

      return true;
    } catch (error) {
      await EnhancedSecurityLogger.logSystemEvent('admin_ip_restriction_setup_error', 'critical', {
        adminUserId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Validate IP restrictions for admin user
   */
  static async validateIPRestrictions(adminUserId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('admin_ip_restrictions')
        .select('*')
        .eq('admin_user_id', adminUserId)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        await EnhancedSecurityLogger.logSystemEvent('admin_ip_validation_error', 'medium', {
          adminUserId,
          error: error.message
        });
        return true; // Fail open if we can't check restrictions
      }

      if (!data) {
        // No restrictions set, allow access
        return true;
      }

      // In a real implementation, you would check the client's IP against the ranges
      // For now, we'll assume client-side can't accurately determine IP
      const clientIP = 'client-side-unknown';
      
      // Log the IP check attempt
      await EnhancedSecurityLogger.logSystemEvent('admin_ip_check', 'info', {
        adminUserId,
        restrictionType: data.restriction_type,
        clientIP
      });

      // For client-side implementation, we'll return true
      // In production, this would be done server-side with actual IP validation
      return true;
    } catch (error) {
      await EnhancedSecurityLogger.logSystemEvent('admin_ip_validation_failed', 'medium', {
        adminUserId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return true; // Fail open
    }
  }

  /**
   * Get admin access tokens (for audit purposes)
   */
  static async getAdminTokens(adminUserId: string): Promise<AdminAccessToken[]> {
    try {
      const { data, error } = await supabase
        .from('admin_access_tokens')
        .select('*')
        .eq('admin_user_id', adminUserId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        await EnhancedSecurityLogger.logSystemEvent('admin_token_query_error', 'medium', {
          adminUserId,
          error: error.message
        });
        return [];
      }

      return (data || []).map(row => ({
        id: row.id,
        adminUserId: row.admin_user_id,
        tokenHash: row.token_hash,
        operationType: row.operation_type,
        ipAddress: row.ip_address,
        expiresAt: row.expires_at,
        usedAt: row.used_at,
        isValid: row.is_valid,
        metadata: (row.metadata as Record<string, any>) || {},
        createdAt: row.created_at
      }));
    } catch (error) {
      await EnhancedSecurityLogger.logSystemEvent('admin_token_query_failed', 'medium', {
        adminUserId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Cleanup expired tokens
   */
  static async cleanupExpiredTokens(): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('admin_access_tokens')
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (error) {
        await EnhancedSecurityLogger.logSystemEvent('admin_token_cleanup_error', 'medium', {
          error: error.message
        });
        return 0;
      }

      const cleanedCount = (data as any[])?.length || 0;
      
      await EnhancedSecurityLogger.logSystemEvent('admin_token_cleanup_completed', 'info', {
        cleanedCount
      });

      return cleanedCount;
    } catch (error) {
      await EnhancedSecurityLogger.logSystemEvent('admin_token_cleanup_failed', 'medium', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 0;
    }
  }

  /**
   * Require sensitive operation authorization
   */
  static async requireSensitiveOperationAuth(
    adminUserId: string,
    operationType: SensitiveOperation,
    token?: string
  ): Promise<{ authorized: boolean; requiresToken: boolean; tokenGenerated?: string }> {
    try {
      // Check if token is provided and valid
      if (token) {
        const isValid = await this.validateAccessToken(token, operationType, adminUserId);
        return {
          authorized: isValid,
          requiresToken: false
        };
      }

      // Generate new token for the operation
      const tokenResult = await this.generateAccessToken(adminUserId, operationType);
      
      if (!tokenResult) {
        return {
          authorized: false,
          requiresToken: true
        };
      }

      return {
        authorized: false,
        requiresToken: true,
        tokenGenerated: tokenResult.token
      };
    } catch (error) {
      await EnhancedSecurityLogger.logSystemEvent('sensitive_operation_auth_error', 'critical', {
        adminUserId,
        operationType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        authorized: false,
        requiresToken: true
      };
    }
  }
}