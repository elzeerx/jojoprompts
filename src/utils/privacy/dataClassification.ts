// Data Classification System for GDPR and privacy compliance
import { supabase } from '@/integrations/supabase/client';
import { EnhancedSecurityLogger } from '@/utils/security/enhancedSecurityLogger';

export type DataClassification = 'public' | 'internal' | 'sensitive' | 'restricted';

export interface DataClassificationRule {
  id: string;
  tableName: string;
  columnName: string;
  classification: DataClassification;
  encryptionRequired: boolean;
  retentionDays?: number;
  accessRoles: string[];
  createdAt: string;
  updatedAt: string;
}

export class DataClassificationManager {
  private static classificationCache: Map<string, DataClassificationRule[]> = new Map();
  private static cacheExpiry: number = 0;
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Get data classification rules for a table
   */
  static async getTableClassification(tableName: string): Promise<DataClassificationRule[]> {
    const cacheKey = `table_${tableName}`;
    const now = Date.now();

    // Check cache first
    if (this.cacheExpiry > now && this.classificationCache.has(cacheKey)) {
      return this.classificationCache.get(cacheKey)!;
    }

    try {
      const { data, error } = await supabase
        .from('data_classification_metadata')
        .select('*')
        .eq('table_name', tableName);

      if (error) {
        await EnhancedSecurityLogger.logSystemEvent('data_classification_query_error', 'medium', {
          tableName,
          error: error.message
        });
        return [];
      }

      const rules: DataClassificationRule[] = (data || []).map(row => ({
        id: row.id,
        tableName: row.table_name,
        columnName: row.column_name,
        classification: row.classification,
        encryptionRequired: row.encryption_required,
        retentionDays: row.retention_days,
        accessRoles: row.access_roles || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));

      // Cache the results
      this.classificationCache.set(cacheKey, rules);
      this.cacheExpiry = now + this.CACHE_DURATION;

      return rules;
    } catch (error) {
      await EnhancedSecurityLogger.logSystemEvent('data_classification_error', 'high', {
        tableName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Get classification for a specific field
   */
  static async getFieldClassification(tableName: string, columnName: string): Promise<DataClassificationRule | null> {
    const tableRules = await this.getTableClassification(tableName);
    return tableRules.find(rule => rule.columnName === columnName) || null;
  }

  /**
   * Check if user has access to classified data
   */
  static async canAccessClassifiedData(
    classification: DataClassification,
    userRole: string,
    isOwner: boolean = false
  ): Promise<boolean> {
    // Public data is always accessible
    if (classification === 'public') {
      return true;
    }

    // Internal data requires authentication
    if (classification === 'internal') {
      return userRole !== 'anonymous';
    }

    // Sensitive data requires specific roles or ownership
    if (classification === 'sensitive') {
      return userRole === 'admin' || userRole === 'jadmin' || isOwner;
    }

    // Restricted data requires admin access only
    if (classification === 'restricted') {
      return userRole === 'admin' || userRole === 'jadmin';
    }

    return false;
  }

  /**
   * Filter data based on classification and user permissions
   */
  static async filterDataByClassification<T extends Record<string, any>>(
    tableName: string,
    data: T[],
    userRole: string,
    userId?: string
  ): Promise<T[]> {
    if (!data.length) return data;

    try {
      const classificationRules = await this.getTableClassification(tableName);
      
      if (!classificationRules.length) {
        // No classification rules, return all data
        return data;
      }

      return data.map(item => {
        const filteredItem = { ...item };

        classificationRules.forEach(rule => {
          const isOwner = userId && item.user_id === userId;
          const canAccess = this.canAccessClassifiedData(rule.classification, userRole, isOwner);

          if (!canAccess && rule.columnName in filteredItem) {
            const columnValue = filteredItem[rule.columnName];
            
            // Remove or mask the field based on classification
            if (rule.classification === 'restricted') {
              delete filteredItem[rule.columnName];
            } else {
              // Mask sensitive data
              (filteredItem as any)[rule.columnName] = this.maskSensitiveData(
                columnValue,
                rule.classification
              );
            }
          }
        });

        return filteredItem;
      });
    } catch (error) {
      await EnhancedSecurityLogger.logSystemEvent('data_filtering_error', 'high', {
        tableName,
        userRole,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return data; // Return original data on error to prevent data loss
    }
  }

  /**
   * Mask sensitive data based on classification level
   */
  private static maskSensitiveData(value: any, classification: DataClassification): any {
    if (value === null || value === undefined) return value;

    const stringValue = String(value);

    switch (classification) {
      case 'sensitive':
        // Partially mask sensitive data
        if (stringValue.includes('@')) {
          // Email masking
          const [local, domain] = stringValue.split('@');
          return `${local.substring(0, 2)}***@${domain}`;
        } else if (stringValue.length > 4) {
          // General string masking
          return `${stringValue.substring(0, 2)}***${stringValue.substring(stringValue.length - 2)}`;
        }
        return '***';
      
      case 'restricted':
        return '[REDACTED]';
      
      default:
        return value;
    }
  }

  /**
   * Log data access for audit purposes
   */
  static async logDataAccess(
    tableName: string,
    columnName: string,
    classification: DataClassification,
    userId?: string
  ): Promise<void> {
    await EnhancedSecurityLogger.logDataAccess(
      'classified_data_access',
      `${tableName}.${columnName}`,
      classification === 'restricted' || classification === 'sensitive' ? 'high' : 'info',
      {
        tableName,
        columnName,
        classification,
        userId
      }
    );
  }

  /**
   * Clear classification cache
   */
  static clearCache(): void {
    this.classificationCache.clear();
    this.cacheExpiry = 0;
  }

  /**
   * Get all classification rules (admin only)
   */
  static async getAllClassificationRules(): Promise<DataClassificationRule[]> {
    try {
      const { data, error } = await supabase
        .from('data_classification_metadata')
        .select('*')
        .order('table_name', { ascending: true });

      if (error) {
        throw error;
      }

      return (data || []).map(row => ({
        id: row.id,
        tableName: row.table_name,
        columnName: row.column_name,
        classification: row.classification,
        encryptionRequired: row.encryption_required,
        retentionDays: row.retention_days,
        accessRoles: row.access_roles || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      await EnhancedSecurityLogger.logSystemEvent('classification_rules_query_error', 'medium', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}