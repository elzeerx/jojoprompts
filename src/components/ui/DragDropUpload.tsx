import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, File, Image, Video, Music, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createLogger } from '@/utils/logging';

const logger = createLogger('DragDropUpload');

interface FileWithPreview extends File {
  preview?: string;
  id: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress?: number;
  error?: string;
}

interface DragDropUploadProps {
  onFilesDrop: (files: File[]) => void;
  onFileRemove?: (fileId: string) => void;
  acceptedTypes?: string[];
  maxFiles?: number;
  maxSize?: number; // in bytes
  preview?: boolean;
  multiple?: boolean;
  className?: string;
  disabled?: boolean;
  showProgress?: boolean;
  customValidation?: (file: File) => string | null;
}

export function DragDropUpload({
  onFilesDrop,
  onFileRemove,
  acceptedTypes = ['*/*'],
  maxFiles = 10,
  maxSize = 50 * 1024 * 1024, // 50MB default
  preview = true,
  multiple = true,
  className,
  disabled = false,
  showProgress = true,
  customValidation
}: DragDropUploadProps) {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate unique ID for files
  const generateFileId = () => `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Validate file
  const validateFile = useCallback((file: File): string | null => {
    // Check file size
    if (file.size > maxSize) {
      return `File size exceeds ${Math.round(maxSize / (1024 * 1024))}MB limit`;
    }

    // Check file type
    if (acceptedTypes.length > 0 && acceptedTypes[0] !== '*/*') {
      const isValidType = acceptedTypes.some(type => {
        if (type.endsWith('/*')) {
          return file.type.startsWith(type.replace('/*', ''));
        }
        return file.type === type;
      });
      
      if (!isValidType) {
        return `File type not supported. Accepted types: ${acceptedTypes.join(', ')}`;
      }
    }

    // Check max files
    if (files.length >= maxFiles) {
      return `Maximum ${maxFiles} files allowed`;
    }

    // Custom validation
    if (customValidation) {
      const customError = customValidation(file);
      if (customError) return customError;
    }

    return null;
  }, [maxSize, acceptedTypes, files.length, maxFiles, customValidation]);

  // Create file preview
  const createFilePreview = useCallback((file: File): Promise<string> => {
    return new Promise((resolve) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      } else {
        resolve('');
      }
    });
  }, []);

  // Process dropped files
  const processFiles = useCallback(async (fileList: FileList) => {
    const newFiles: FileWithPreview[] = [];
    const errors: string[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const error = validateFile(file);
      
      if (error) {
        errors.push(`${file.name}: ${error}`);
        continue;
      }

      const fileWithPreview: FileWithPreview = {
        ...file,
        id: generateFileId(),
        status: 'pending',
        progress: 0
      };

      // Create preview for images
      if (preview && file.type.startsWith('image/')) {
        fileWithPreview.preview = await createFilePreview(file);
      }

      newFiles.push(fileWithPreview);
    }

    if (errors.length > 0) {
      logger.warn('File validation errors', { errors, errorCount: errors.length });
    }

    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles]);
      onFilesDrop(newFiles.map(f => f as File));
    }
  }, [validateFile, preview, createFilePreview, onFilesDrop]);

  // Handle file input change
  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (fileList) {
      processFiles(fileList);
    }
    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [processFiles]);

  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (disabled) return;

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      processFiles(droppedFiles);
    }
  }, [disabled, processFiles]);

  // Remove file
  const handleRemoveFile = useCallback((fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
    if (onFileRemove) {
      onFileRemove(fileId);
    }
  }, [onFileRemove]);

  // Get file icon
  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <Image className="h-8 w-8" />;
    if (file.type.startsWith('video/')) return <Video className="h-8 w-8" />;
    if (file.type.startsWith('audio/')) return <Music className="h-8 w-8" />;
    if (file.type.includes('json')) return <FileText className="h-8 w-8" />;
    return <File className="h-8 w-8" />;
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get status icon
  const getStatusIcon = (status: FileWithPreview['status']) => {
    switch (status) {
      case 'uploading':
        return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  return (
    <div className={cn("w-full", className)}>
      {/* Drag & Drop Zone */}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
          isDragOver
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <p className="text-sm text-gray-600 mb-2">
          Drag and drop files here, or{' '}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-blue-600 hover:text-blue-700 underline"
            disabled={disabled}
          >
            browse
          </button>
        </p>
        <p className="text-xs text-gray-500">
          {acceptedTypes[0] === '*/*' 
            ? 'All file types accepted'
            : `Accepted types: ${acceptedTypes.join(', ')}`
          }
          {maxSize && ` • Max size: ${formatFileSize(maxSize)}`}
          {maxFiles && ` • Max files: ${maxFiles}`}
        </p>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={acceptedTypes.join(',')}
          onChange={handleFileInputChange}
          className="hidden"
          disabled={disabled}
        />
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Selected Files ({files.length})</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  {/* File Preview/Icon */}
                  {file.preview ? (
                    <img
                      src={file.preview}
                      alt={file.name}
                      className="h-10 w-10 object-cover rounded"
                    />
                  ) : (
                    <div className="h-10 w-10 bg-gray-200 rounded flex items-center justify-center">
                      {getFileIcon(file)}
                    </div>
                  )}

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.size)}
                    </p>
                  </div>

                  {/* Status */}
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(file.status)}
                    {file.error && (
                      <Alert className="p-2">
                        <AlertDescription className="text-xs">
                          {file.error}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </div>

                {/* Remove Button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveFile(file.id)}
                  className="ml-2 h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {showProgress && uploading && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>Uploading files...</span>
            <span>{files.filter(f => f.status === 'success').length} / {files.length}</span>
          </div>
          <Progress 
            value={(files.filter(f => f.status === 'success').length / files.length) * 100} 
            className="h-2"
          />
        </div>
      )}
    </div>
  );
} 