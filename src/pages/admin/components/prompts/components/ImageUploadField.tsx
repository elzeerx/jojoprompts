
import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface ImageUploadFieldProps {
  imageURL: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
}

export const ImageUploadField: React.FC<ImageUploadFieldProps> = ({
  imageURL,
  file,
  onFileChange,
}) => {
  return (
    <div className="grid grid-cols-4 items-center gap-4">
      <Label htmlFor="image" className="text-right">
        Image
      </Label>
      <div className="col-span-3 space-y-4">
        <Input
          type="file"
          id="image"
          accept="image/*"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          className="cursor-pointer"
        />
        {(imageURL || file) && (
          <div className="rounded-lg overflow-hidden bg-muted">
            <img
              src={file ? URL.createObjectURL(file) : imageURL}
              alt="Preview"
              className="w-full aspect-video object-cover"
            />
          </div>
        )}
      </div>
    </div>
  );
};
