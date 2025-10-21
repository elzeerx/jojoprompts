// User consent management for GDPR compliance
import { supabase } from '@/integrations/supabase/client';
import { EnhancedSecurityLogger } from '@/utils/security/enhancedSecurityLogger';

export interface ConsentRecord {
  id: string;
  userId: string;
  consentType: string;
  consentGiven: boolean;
  consentVersion: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  expiresAt?: string;
  withdrawnAt?: string;
}

export interface ConsentRequest {
  consentType: string;
  consentGiven: boolean;
  consentVersion?: string;
  expiresAt?: string;
}

export type ConsentType = 
  | 'data_processing'
  | 'marketing_communications'
  | 'analytics_tracking'
  | 'third_party_sharing'
  | 'cookies_functional'
  | 'cookies_analytics'
  | 'cookies_marketing';

export class ConsentManager {
  private static readonly DEFAULT_CONSENT_VERSION = '1.0';
  private static readonly CONSENT_EXPIRY_DAYS = 365; // 1 year

  /**
   * Record user consent
   */
  static async recordConsent(
    userId: string,
    consentRequests: ConsentRequest[]
  ): Promise<ConsentRecord[]> {
    try {
      const clientInfo = this.getClientInfo();
      const records: ConsentRecord[] = [];

      for (const request of consentRequests) {
        const consentData = {
          user_id: userId,
          consent_type: request.consentType,
          consent_given: request.consentGiven,
          consent_version: request.consentVersion || this.DEFAULT_CONSENT_VERSION,
          ip_address: clientInfo.ipAddress,
          user_agent: clientInfo.userAgent,
          expires_at: request.expiresAt || this.getDefaultExpiryDate()
        };

        const { data, error } = await supabase
          .from('user_privacy_consent')
          .upsert(consentData, {
            onConflict: 'user_id,consent_type,consent_version'
          })
          .select()
          .single();

        if (error) {
          await EnhancedSecurityLogger.logSystemEvent('consent_recording_error', 'high', {
            userId,
            consentType: request.consentType,
            error: error.message
          });
          throw error;
        }

        if (data) {
          records.push({
            id: data.id,
            userId: data.user_id,
            consentType: data.consent_type,
            consentGiven: data.consent_given,
            consentVersion: data.consent_version,
            ipAddress: data.ip_address,
            userAgent: data.user_agent,
            createdAt: data.created_at,
            expiresAt: data.expires_at,
            withdrawnAt: data.withdrawn_at
          });

          await EnhancedSecurityLogger.logSystemEvent('consent_recorded', 'info', {
            userId,
            consentType: request.consentType,
            consentGiven: request.consentGiven,
            consentVersion: request.consentVersion || this.DEFAULT_CONSENT_VERSION
          });
        }
      }

      return records;
    } catch (error) {
      await EnhancedSecurityLogger.logSystemEvent('consent_recording_failed', 'high', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get user's consent records
   */
  static async getUserConsents(userId: string): Promise<ConsentRecord[]> {
    try {
      const { data, error } = await supabase
        .from('user_privacy_consent')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        await EnhancedSecurityLogger.logSystemEvent('consent_query_error', 'medium', {
          userId,
          error: error.message
        });
        throw error;
      }

      return (data || []).map(row => ({
        id: row.id,
        userId: row.user_id,
        consentType: row.consent_type,
        consentGiven: row.consent_given,
        consentVersion: row.consent_version,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        withdrawnAt: row.withdrawn_at
      }));
    } catch (error) {
      await EnhancedSecurityLogger.logSystemEvent('consent_query_failed', 'medium', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Check if user has given specific consent
   */
  static async hasConsent(
    userId: string,
    consentType: ConsentType,
    consentVersion?: string
  ): Promise<boolean> {
    try {
      const consents = await this.getUserConsents(userId);
      const relevantConsent = consents.find(consent => 
        consent.consentType === consentType &&
        (!consentVersion || consent.consentVersion === consentVersion) &&
        !consent.withdrawnAt &&
        (!consent.expiresAt || new Date(consent.expiresAt) > new Date())
      );

      return relevantConsent?.consentGiven || false;
    } catch (error) {
      await EnhancedSecurityLogger.logSystemEvent('consent_check_error', 'medium', {
        userId,
        consentType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false; // Fail closed - no consent assumed
    }
  }

  /**
   * Withdraw consent
   */
  static async withdrawConsent(
    userId: string,
    consentType: ConsentType,
    consentVersion?: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_privacy_consent')
        .update({
          consent_given: false,
          withdrawn_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('consent_type', consentType)
        .eq('consent_version', consentVersion || this.DEFAULT_CONSENT_VERSION);

      if (error) {
        await EnhancedSecurityLogger.logSystemEvent('consent_withdrawal_error', 'high', {
          userId,
          consentType,
          error: error.message
        });
        return false;
      }

      await EnhancedSecurityLogger.logSystemEvent('consent_withdrawn', 'info', {
        userId,
        consentType,
        consentVersion: consentVersion || this.DEFAULT_CONSENT_VERSION
      });

      return true;
    } catch (error) {
      await EnhancedSecurityLogger.logSystemEvent('consent_withdrawal_failed', 'high', {
        userId,
        consentType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Get consent status for all consent types
   */
  static async getConsentStatus(userId: string): Promise<Record<ConsentType, boolean>> {
    const consentTypes: ConsentType[] = [
      'data_processing',
      'marketing_communications',
      'analytics_tracking',
      'third_party_sharing',
      'cookies_functional',
      'cookies_analytics',
      'cookies_marketing'
    ];

    const status: Record<ConsentType, boolean> = {} as Record<ConsentType, boolean>;

    for (const consentType of consentTypes) {
      status[consentType] = await this.hasConsent(userId, consentType);
    }

    return status;
  }

  /**
   * Check if consent is required for an action
   */
  static isConsentRequired(action: string): ConsentType[] {
    const consentMapping: Record<string, ConsentType[]> = {
      'email_marketing': ['marketing_communications'],
      'analytics_tracking': ['analytics_tracking'],
      'data_export': ['data_processing'],
      'third_party_api': ['third_party_sharing'],
      'functional_cookies': ['cookies_functional'],
      'analytics_cookies': ['cookies_analytics'],
      'marketing_cookies': ['cookies_marketing']
    };

    return consentMapping[action] || ['data_processing'];
  }

  /**
   * Validate consent before performing actions
   */
  static async validateConsentForAction(
    userId: string,
    action: string
  ): Promise<{ allowed: boolean; missingConsents: ConsentType[] }> {
    const requiredConsents = this.isConsentRequired(action);
    const missingConsents: ConsentType[] = [];

    for (const consentType of requiredConsents) {
      const hasConsent = await this.hasConsent(userId, consentType);
      if (!hasConsent) {
        missingConsents.push(consentType);
      }
    }

    const allowed = missingConsents.length === 0;

    if (!allowed) {
      await EnhancedSecurityLogger.logAuthorizationFailure(
        'consent_validation_failed',
        action,
        { userId, missingConsents }
      );
    }

    return { allowed, missingConsents };
  }

  /**
   * Get client information for consent recording
   */
  private static getClientInfo(): { ipAddress: string; userAgent: string } {
    return {
      ipAddress: 'client-side', // Would need server-side implementation for real IP
      userAgent: navigator.userAgent
    };
  }

  /**
   * Get default expiry date for consent
   */
  private static getDefaultExpiryDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + this.CONSENT_EXPIRY_DAYS);
    return date.toISOString();
  }

  /**
   * Cleanup expired consents
   */
  static async cleanupExpiredConsents(): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('user_privacy_consent')
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (error) {
        await EnhancedSecurityLogger.logSystemEvent('consent_cleanup_error', 'medium', {
          error: error.message
        });
        return 0;
      }

      const cleanedCount = (data as any[])?.length || 0;
      
      await EnhancedSecurityLogger.logSystemEvent('consent_cleanup_completed', 'info', {
        cleanedCount
      });

      return cleanedCount;
    } catch (error) {
      await EnhancedSecurityLogger.logSystemEvent('consent_cleanup_failed', 'medium', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 0;
    }
  }
}