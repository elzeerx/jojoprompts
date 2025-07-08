
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

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
    setIsValidating(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileType', fileType);

      const { data, error } = await supabase.functions.invoke('validate-file-upload', {
        body: formData
      });

      if (error) {
        throw new Error(error.message);
      }

      return data as FileValidationResult;
    } catch (error) {
      console.error('File validation error:', error);
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'File validation failed'
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
