import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { createLogger } from '@/utils/logging';

const logger = createLogger('SECURE_FILE_UPLOAD');

interface FileValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedFilename?: string;
  fileSize?: number;
  mimeType?: string;
}

export function useSecureFileUpload() {
  const [isValidating, setIsValidating] = useState(false);

  const validateFile = async (
    file: File,
    fileType: 'image' | 'document'
  ): Promise<FileValidationResult> => {
    // RETIRED (source-only, 2026-07-28): `validate-file-upload` is now a
    // 410 stub. Replacement: `v2-admin-upload-resource-file` performs
    // server-side validation as part of the multipart upload flow.
    // This hook's only importer (`SecureImageUploadField.tsx`) has no
    // active route parent (unreachable from `adminSectionElements.tsx`).
    setIsValidating(true);
    try {
      logger.warn('validate-file-upload is retired; use v2-admin-upload-resource-file', {
        fileName: file.name,
        fileType,
      });
      return {
        isValid: false,
        error:
          'endpoint_retired: validate-file-upload. Use v2-admin-upload-resource-file.',
      };
    } finally {
      setIsValidating(false);
    }
  };


  const secureUpload = async (
    file: File,
    path: string,
    fileType: 'image' | 'document' = 'image'
  ) => {
    // First validate the file
    const validation = await validateFile(file, fileType);
    
    if (!validation.isValid) {
      toast({
        title: "File Upload Failed",
        description: validation.error,
        variant: "destructive",
      });
      throw new Error(validation.error);
    }

    // Use sanitized filename
    const sanitizedPath = validation.sanitizedFilename 
      ? path.replace(file.name, validation.sanitizedFilename)
      : path;

    // Proceed with secure upload
    const { data, error } = await supabase.storage
      .from('uploads')
      .upload(sanitizedPath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }

    return { data, sanitizedPath };
  };

  return {
    validateFile,
    secureUpload,
    isValidating
  };
}
