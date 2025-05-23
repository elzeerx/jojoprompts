
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface ImageUploadFieldProps {
  imageUrl?: string;
  onImageChange: (path: string) => void;
  onFileChange: (file: File) => void;
  label: string;
}

export function ImageUploadField({ 
  imageUrl, 
  onImageChange, 
  onFileChange, 
  label 
}: ImageUploadFieldProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileChange(file);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <Input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="cursor-pointer"
      />
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
