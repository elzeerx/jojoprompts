
import { SecurityUtils } from '../../security';
import { ValidationResult, FileValidationOptions } from './ValidationTypes';

export class FileValidator {
  static validateFile(
    file: File,
    options: FileValidationOptions
  ): ValidationResult {
    const errors: string[] = [];
    const { allowedTypes, maxSizeMB, required = true } = options;

    if (!file && required) {
      errors.push('File is required');
      return { isValid: false, errors };
    }

    if (file) {
      const validation = SecurityUtils.validateFileUpload(file, allowedTypes, maxSizeMB);
      if (!validation.isValid && validation.error) {
        errors.push(validation.error);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: file
    };
  }
}
