import React, { useState, useRef, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, X, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ThumbnailUploadProps {
  value?: File | null;
  existingUrl?: string;
  onChange: (file: File | null) => void;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export function ThumbnailUpload({
  value,
  existingUrl,
  onChange,
  error,
  disabled = false,
  className
}: ThumbnailUploadProps) {
  const [preview, setPreview] = useState<string | null>(existingUrl || null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasError = !!error || !!fileError;
  const maxSize = 5 * 1024 * 1024; // 5MB
  const acceptedFormats = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

  // Update preview when existingUrl changes
  useEffect(() => {
    if (existingUrl && !preview) {
      setPreview(existingUrl);
    }
  }, [existingUrl, preview]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Clear previous errors
    setFileError(null);

    // Validate file type
    if (!acceptedFormats.includes(file.type)) {
      setFileError('Please select a valid image file (PNG, JPG, WEBP)');
      return;
    }

    // Validate file size
    if (file.size > maxSize) {
      setFileError(`File size must be less than ${(maxSize / 1024 / 1024).toFixed(0)}MB`);
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.onerror = () => {
      setFileError('Failed to read file. Please try again.');
    };
    reader.readAsDataURL(file);

    onChange(file);
  };

  const handleRemove = () => {
    setPreview(null);
    setFileError(null);
    onChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  const displayError = error || fileError;

  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-sm font-medium">
        Prompt Thumbnail <span className="text-muted-foreground text-xs font-normal">(Optional)</span>
      </Label>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
        aria-label="Upload thumbnail image"
      />

      {preview ? (
        // Preview card with image
        <Card className={cn(
          "relative overflow-hidden group",
          hasError && "border-destructive ring-2 ring-destructive/20"
        )}>
          <img
            src={preview}
            alt="Thumbnail preview"
            className="w-full h-48 sm:h-56 object-cover"
            onError={() => {
              setFileError('Failed to load image preview');
              setPreview(null);
            }}
          />
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-4">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleClick}
              disabled={disabled}
              className="shadow-lg"
            >
              <Upload className="h-4 w-4 mr-2" />
              Change
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleRemove}
              disabled={disabled}
              className="shadow-lg"
            >
              <X className="h-4 w-4 mr-2" />
              Remove
            </Button>
          </div>
          {/* Mobile-friendly buttons */}
          <div className="sm:hidden absolute bottom-2 right-2 flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={handleClick}
              disabled={disabled}
              className="h-8 w-8 shadow-lg"
            >
              <Upload className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="icon"
              onClick={handleRemove}
              disabled={disabled}
              className="h-8 w-8 shadow-lg"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      ) : (
        // Upload placeholder
        <Card
          className={cn(
            "border-2 border-dashed cursor-pointer transition-all duration-200",
            "hover:border-primary hover:bg-muted/50 hover:shadow-md",
            hasError && "border-destructive ring-2 ring-destructive/20",
            disabled && "cursor-not-allowed opacity-50 hover:border-border hover:bg-transparent hover:shadow-none"
          )}
          onClick={handleClick}
          role="button"
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
              e.preventDefault();
              handleClick();
            }
          }}
          aria-label="Upload thumbnail image"
        >
          <div className="flex flex-col items-center justify-center py-10 sm:py-12 px-6 text-center">
            <div className={cn(
              "p-3 rounded-full mb-4 transition-colors",
              disabled ? "bg-muted" : "bg-muted group-hover:bg-primary/10"
            )}>
              <ImageIcon className={cn(
                "h-8 w-8 sm:h-10 sm:w-10 transition-colors",
                disabled ? "text-muted-foreground" : "text-muted-foreground group-hover:text-primary"
              )} />
            </div>
            <p className="text-sm font-medium mb-1">Click to upload thumbnail</p>
            <p className="text-xs text-muted-foreground">
              PNG, JPG, WEBP up to {(maxSize / 1024 / 1024).toFixed(0)}MB
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Recommended: 1200x630px (16:9 ratio)
            </p>
          </div>
        </Card>
      )}

      {displayError && (
        <Alert variant="destructive" className="animate-fade-in">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs sm:text-sm">
            {displayError}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
