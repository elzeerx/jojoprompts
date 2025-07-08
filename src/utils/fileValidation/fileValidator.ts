
// File validation utilities
export class FileValidator {
  // Validate file upload
  static validateFileUpload(file: File, allowedTypes: string[], maxSizeMB: number = 10): { isValid: boolean; error?: string } {
    if (!file) {
      return { isValid: false, error: 'File is required' };
    }

    // Check file type
    if (!allowedTypes.includes(file.type)) {
      return { isValid: false, error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}` };
    }

    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return { isValid: false, error: `File size must be less than ${maxSizeMB}MB` };
    }

    return { isValid: true };
  }
}
