
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useSecureFileUpload } from "@/hooks/useSecureFileUpload";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface SecureImageUploadFieldProps {
  imageUrl?: string;
  onImageChange: (path: string) => void;
  onFileChange: (file: File) => void;
  label: string;
}

export function SecureImageUploadField({ 
  imageUrl, 
  onImageChange, 
  onFileChange, 
  label 
}: SecureImageUploadFieldProps) {
  const { validateFile, isValidating } = useSecureFileUpload();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file before processing
    const validation = await validateFile(file, 'image');
    
    if (!validation.isValid) {
      toast({
        title: "Invalid File",
        description: validation.error,
        variant: "destructive",
      });
      // Clear the input
      e.target.value = '';
      return;
    }

    // File is valid, proceed
    onFileChange(file);
    
    toast({
      title: "File Validated",
      description: "Image file is valid and ready for upload",
    });
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="relative">
        <Input
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
          onChange={handleFileChange}
          className="cursor-pointer"
          disabled={isValidating}
        />
        {isValidating && (
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
      </div>
      {imageUrl && (
        <div className="mt-2">
          <img
            src={imageUrl}
            alt="Preview"
            className="w-32 h-32 object-cover rounded-lg border"
          />
        </div>
      )}
    </div>
  );
}
