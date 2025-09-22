// Field-level encryption for sensitive data
import { EnhancedSecurityLogger } from '@/utils/security/enhancedSecurityLogger';

export interface EncryptionResult {
  encryptedData: string;
  keyId: string;
  algorithm: string;
  timestamp: string;
}

export interface DecryptionResult {
  decryptedData: string;
  keyId: string;
  algorithm: string;
}

export class FieldEncryption {
  private static readonly CURRENT_KEY_VERSION = 'v1';
  private static readonly ALGORITHM = 'AES-GCM';
  private static encryptionKeys: Map<string, CryptoKey> = new Map();

  /**
   * Initialize encryption with a master key
   */
  static async initialize(): Promise<void> {
    try {
      // In production, this would come from a secure key management service
      // For now, we'll generate a key and store it in memory
      const key = await this.generateEncryptionKey();
      this.encryptionKeys.set(this.CURRENT_KEY_VERSION, key);

      await EnhancedSecurityLogger.logSystemEvent('encryption_initialized', 'info', {
        keyVersion: this.CURRENT_KEY_VERSION,
        algorithm: this.ALGORITHM
      });
    } catch (error) {
      await EnhancedSecurityLogger.logSystemEvent('encryption_init_error', 'critical', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Generate a new encryption key
   */
  private static async generateEncryptionKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true, // extractable
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt sensitive field data
   */
  static async encryptField(data: string): Promise<EncryptionResult> {
    if (!data || typeof data !== 'string') {
      throw new Error('Invalid data for encryption');
    }

    try {
      const key = this.encryptionKeys.get(this.CURRENT_KEY_VERSION);
      if (!key) {
        await this.initialize();
        const newKey = this.encryptionKeys.get(this.CURRENT_KEY_VERSION);
        if (!newKey) {
          throw new Error('Failed to initialize encryption key');
        }
      }

      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      
      // Generate a random IV for each encryption
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        this.encryptionKeys.get(this.CURRENT_KEY_VERSION)!,
        dataBuffer
      );

      // Combine IV and encrypted data
      const combinedBuffer = new Uint8Array(iv.length + encryptedBuffer.byteLength);
      combinedBuffer.set(iv);
      combinedBuffer.set(new Uint8Array(encryptedBuffer), iv.length);

      // Convert to base64 for storage
      const encryptedData = btoa(String.fromCharCode(...combinedBuffer));

      const result: EncryptionResult = {
        encryptedData,
        keyId: this.CURRENT_KEY_VERSION,
        algorithm: this.ALGORITHM,
        timestamp: new Date().toISOString()
      };

      await EnhancedSecurityLogger.logSystemEvent('field_encrypted', 'info', {
        keyId: this.CURRENT_KEY_VERSION,
        dataLength: data.length
      });

      return result;
    } catch (error) {
      await EnhancedSecurityLogger.logSystemEvent('field_encryption_error', 'high', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Decrypt sensitive field data
   */
  static async decryptField(encryptionResult: EncryptionResult): Promise<string> {
    try {
      const key = this.encryptionKeys.get(encryptionResult.keyId);
      if (!key) {
        // Try to load the key (in production, this would come from key management service)
        await this.initialize();
        const newKey = this.encryptionKeys.get(encryptionResult.keyId);
        if (!newKey) {
          throw new Error(`Encryption key ${encryptionResult.keyId} not found`);
        }
      }

      // Convert from base64
      const combinedBuffer = new Uint8Array(
        atob(encryptionResult.encryptedData)
          .split('')
          .map(char => char.charCodeAt(0))
      );

      // Extract IV and encrypted data
      const iv = combinedBuffer.slice(0, 12);
      const encryptedData = combinedBuffer.slice(12);

      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        this.encryptionKeys.get(encryptionResult.keyId)!,
        encryptedData
      );

      const decoder = new TextDecoder();
      const decryptedData = decoder.decode(decryptedBuffer);

      await EnhancedSecurityLogger.logSystemEvent('field_decrypted', 'info', {
        keyId: encryptionResult.keyId
      });

      return decryptedData;
    } catch (error) {
      await EnhancedSecurityLogger.logSystemEvent('field_decryption_error', 'high', {
        keyId: encryptionResult.keyId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Encrypt an object's sensitive fields
   */
  static async encryptSensitiveFields(
    data: Record<string, any>,
    sensitiveFields: string[]
  ): Promise<Record<string, any>> {
    const result = { ...data };

    for (const field of sensitiveFields) {
      if (result[field] && typeof result[field] === 'string') {
        try {
          const encrypted = await this.encryptField(result[field]);
          result[field] = encrypted;
        } catch (error) {
          await EnhancedSecurityLogger.logSystemEvent('object_field_encryption_error', 'high', {
            field,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          // Keep original value on encryption failure
        }
      }
    }

    return result;
  }

  /**
   * Decrypt an object's encrypted fields
   */
  static async decryptSensitiveFields(
    data: Record<string, any>,
    encryptedFields: string[]
  ): Promise<Record<string, any>> {
    const result = { ...data };

    for (const field of encryptedFields) {
      if (result[field] && typeof result[field] === 'object' && result[field].encryptedData) {
        try {
          const decrypted = await this.decryptField(result[field]);
          result[field] = decrypted;
        } catch (error) {
          await EnhancedSecurityLogger.logSystemEvent('object_field_decryption_error', 'high', {
            field,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          // Keep encrypted value on decryption failure
        }
      }
    }

    return result;
  }

  /**
   * Rotate encryption keys (for key management)
   */
  static async rotateKeys(): Promise<void> {
    try {
      const newVersion = `v${Date.now()}`;
      const newKey = await this.generateEncryptionKey();
      
      this.encryptionKeys.set(newVersion, newKey);
      
      await EnhancedSecurityLogger.logSystemEvent('encryption_key_rotated', 'info', {
        oldVersion: this.CURRENT_KEY_VERSION,
        newVersion
      });

      // In production, you would update the current key version
      // and re-encrypt data with the new key
    } catch (error) {
      await EnhancedSecurityLogger.logSystemEvent('key_rotation_error', 'critical', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Check if data is encrypted
   */
  static isEncrypted(data: any): boolean {
    return (
      data &&
      typeof data === 'object' &&
      typeof data.encryptedData === 'string' &&
      typeof data.keyId === 'string' &&
      typeof data.algorithm === 'string'
    );
  }

  /**
   * Get encryption status for debugging
   */
  static getEncryptionStatus(): {
    initialized: boolean;
    keyCount: number;
    currentVersion: string;
    algorithm: string;
  } {
    return {
      initialized: this.encryptionKeys.size > 0,
      keyCount: this.encryptionKeys.size,
      currentVersion: this.CURRENT_KEY_VERSION,
      algorithm: this.ALGORITHM
    };
  }
}
