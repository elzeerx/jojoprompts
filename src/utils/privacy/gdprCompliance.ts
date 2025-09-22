// GDPR compliance utilities for data export and deletion
import { supabase } from '@/integrations/supabase/client';
import { EnhancedSecurityLogger } from '@/utils/security/enhancedSecurityLogger';
import { ConsentManager } from './consentManager';

export interface DataExportResult {
  success: boolean;
  userId: string;
  exportTimestamp: string;
  data: Record<string, any>;
  error?: string;
}

export interface DataDeletionResult {
  success: boolean;
  userId: string;
  deletionTimestamp: string;
  deletedTables: string[];
  error?: string;
}

export class GDPRCompliance {
  /**
   * Export all user data for GDPR compliance
   */
  static async exportUserData(userId: string): Promise<DataExportResult> {
    try {
      await EnhancedSecurityLogger.logDataAccess(
        'gdpr_data_export',
        'all_user_data',
        'high',
        { userId, action: 'export_initiated' }
      );

      // Call the database function for data export
      const { data, error } = await supabase
        .rpc('export_user_data', { target_user_id: userId });

      if (error) {
        await EnhancedSecurityLogger.logSystemEvent('gdpr_export_error', 'high', {
          userId,
          error: error.message
        });

        return {
          success: false,
          userId,
          exportTimestamp: new Date().toISOString(),
          data: {},
          error: error.message
        };
      }

      if (data && typeof data === 'object' && 'error' in data && data.error) {
        return {
          success: false,
          userId,
          exportTimestamp: new Date().toISOString(),
          data: {},
          error: String(data.error)
        };
      }

      const resultData = data as any;
      
      await EnhancedSecurityLogger.logDataAccess(
        'gdpr_data_export_completed',
        'all_user_data',
        'high',
        { 
          userId, 
          exportTimestamp: resultData.export_timestamp,
          dataSize: JSON.stringify(resultData.data).length 
        }
      );

      return {
        success: true,
        userId: resultData.user_id,
        exportTimestamp: resultData.export_timestamp,
        data: resultData.data
      };
    } catch (error) {
      await EnhancedSecurityLogger.logSystemEvent('gdpr_export_failed', 'critical', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        userId,
        exportTimestamp: new Date().toISOString(),
        data: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Delete all user data for GDPR compliance (Right to be forgotten)
   */
  static async deleteUserData(userId: string, adminUserId?: string): Promise<DataDeletionResult> {
    try {
      await EnhancedSecurityLogger.logDataAccess(
        'gdpr_data_deletion',
        'all_user_data',
        'critical',
        { userId, adminUserId, action: 'deletion_initiated' }
      );

      let result;
      
      if (adminUserId) {
        // Admin-initiated deletion
        const { data, error } = await supabase
          .rpc('admin_delete_user_data', { target_user_id: userId });
        
        if (error) throw error;
        result = data;
      } else {
        // User-initiated deletion
        const { data, error } = await supabase
          .rpc('delete_user_account', { _user_id: userId });
        
        if (error) throw error;
        result = data;
      }

      if (!result.success) {
        return {
          success: false,
          userId,
          deletionTimestamp: new Date().toISOString(),
          deletedTables: [],
          error: result.error
        };
      }

      await EnhancedSecurityLogger.logDataAccess(
        'gdpr_data_deletion_completed',
        'all_user_data',
        'critical',
        { 
          userId,
          adminUserId,
          deletionTimestamp: result.deletion_timestamp || new Date().toISOString(),
          duration: result.duration_ms
        }
      );

      return {
        success: true,
        userId,
        deletionTimestamp: result.deletion_timestamp || new Date().toISOString(),
        deletedTables: this.getDeletedTablesList()
      };
    } catch (error) {
      await EnhancedSecurityLogger.logSystemEvent('gdpr_deletion_failed', 'critical', {
        userId,
        adminUserId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        userId,
        deletionTimestamp: new Date().toISOString(),
        deletedTables: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate a comprehensive data processing report
   */
  static async generateDataProcessingReport(userId: string): Promise<{
    userId: string;
    reportTimestamp: string;
    consentStatus: Record<string, boolean>;
    dataCategories: Array<{
      category: string;
      tables: string[];
      classification: string;
      retention: string;
    }>;
    processingActivities: Array<{
      activity: string;
      legalBasis: string;
      dataTypes: string[];
      retentionPeriod: string;
    }>;
  }> {
    try {
      // Get consent status
      const consentStatus = await ConsentManager.getConsentStatus(userId);

      // Define data categories and their processing
      const dataCategories = [
        {
          category: 'Identity Data',
          tables: ['profiles'],
          classification: 'internal',
          retention: '5 years after account closure'
        },
        {
          category: 'Contact Data',
          tables: ['profiles'],
          classification: 'sensitive',
          retention: '2 years after last contact'
        },
        {
          category: 'Transaction Data',
          tables: ['transactions', 'user_subscriptions'],
          classification: 'sensitive',
          retention: '7 years (legal requirement)'
        },
        {
          category: 'Usage Data',
          tables: ['prompt_usage_history', 'security_logs'],
          classification: 'internal',
          retention: '1 year'
        },
        {
          category: 'Communication Data',
          tables: ['email_logs'],
          classification: 'internal',
          retention: '6 months'
        }
      ];

      const processingActivities = [
        {
          activity: 'Account Management',
          legalBasis: 'Contract performance',
          dataTypes: ['Identity', 'Contact'],
          retentionPeriod: '5 years after account closure'
        },
        {
          activity: 'Payment Processing',
          legalBasis: 'Contract performance',
          dataTypes: ['Transaction', 'Identity'],
          retentionPeriod: '7 years (legal requirement)'
        },
        {
          activity: 'Service Improvement',
          legalBasis: 'Legitimate interest',
          dataTypes: ['Usage', 'Anonymous analytics'],
          retentionPeriod: '2 years'
        },
        {
          activity: 'Marketing Communications',
          legalBasis: 'Consent',
          dataTypes: ['Contact', 'Preference'],
          retentionPeriod: 'Until consent withdrawn'
        }
      ];

      await EnhancedSecurityLogger.logDataAccess(
        'gdpr_processing_report_generated',
        'data_processing_activities',
        'info',
        { userId }
      );

      return {
        userId,
        reportTimestamp: new Date().toISOString(),
        consentStatus,
        dataCategories,
        processingActivities
      };
    } catch (error) {
      await EnhancedSecurityLogger.logSystemEvent('gdpr_report_error', 'medium', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Run automated data retention cleanup
   */
  static async runDataRetentionCleanup(): Promise<{
    success: boolean;
    totalCleaned: number;
    details: Record<string, number>;
    timestamp: string;
  }> {
    try {
      await EnhancedSecurityLogger.logSystemEvent('data_retention_cleanup_started', 'info');

      const { data, error } = await supabase
        .rpc('cleanup_expired_data');

      if (error) {
        await EnhancedSecurityLogger.logSystemEvent('data_retention_cleanup_error', 'high', {
          error: error.message
        });
        throw error;
      }

      if (data && typeof data === 'object' && 'error' in data && data.error) {
        throw new Error(String(data.error));
      }

      const resultData = data as any;

      await EnhancedSecurityLogger.logSystemEvent('data_retention_cleanup_completed', 'info', {
        totalCleaned: resultData.total_records_cleaned,
        details: resultData.cleanup_details
      });

      return {
        success: true,
        totalCleaned: resultData.total_records_cleaned,
        details: resultData.cleanup_details,
        timestamp: resultData.cleanup_timestamp
      };
    } catch (error) {
      await EnhancedSecurityLogger.logSystemEvent('data_retention_cleanup_failed', 'high', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        totalCleaned: 0,
        details: {},
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Validate GDPR compliance for data processing
   */
  static async validateGDPRCompliance(
    userId: string,
    processingPurpose: string
  ): Promise<{
    compliant: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // Check consent status
      const consentValidation = await ConsentManager.validateConsentForAction(userId, processingPurpose);
      if (!consentValidation.allowed) {
        issues.push(`Missing consent for: ${consentValidation.missingConsents.join(', ')}`);
        recommendations.push('Obtain required consent before processing');
      }

      // Check data retention compliance
      // This would check if data is being kept longer than necessary
      
      // Check if user has active right to erasure requests
      // This would check for pending deletion requests

      const compliant = issues.length === 0;

      await EnhancedSecurityLogger.logSystemEvent('gdpr_compliance_check', 'info', {
        userId,
        processingPurpose,
        compliant,
        issueCount: issues.length
      });

      return {
        compliant,
        issues,
        recommendations
      };
    } catch (error) {
      await EnhancedSecurityLogger.logSystemEvent('gdpr_compliance_check_error', 'medium', {
        userId,
        processingPurpose,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        compliant: false,
        issues: ['Unable to validate compliance'],
        recommendations: ['Manual review required']
      };
    }
  }

  /**
   * Get list of tables that would be deleted in user data deletion
   */
  private static getDeletedTablesList(): string[] {
    return [
      'profiles',
      'security_logs',
      'email_logs',
      'admin_audit_log',
      'collection_prompts',
      'collections',
      'prompt_shares',
      'prompt_usage_history',
      'user_subscriptions',
      'transactions',
      'favorites',
      'prompts',
      'discount_code_usage',
      'user_privacy_consent'
    ];
  }
}