
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ImagePlus, Upload, X } from "lucide-react";

interface ImageUploadFieldProps {
  imageURL: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  promptType: "text" | "image" | "image-selection";
}

export const ImageUploadField = ({ imageURL, file, onFileChange, promptType }: ImageUploadFieldProps) => {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type.startsWith("image/")) {
        onFileChange(droppedFile);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileChange(e.target.files[0]);
    }
  };

  const removeFile = () => {
    onFileChange(null);
  };

  const getImageLabelText = () => {
    switch (promptType) {
      case "image":
        return "Prompt Image";
      case "image-selection":
        return "Selection Preview";
      case "text":
        return "Custom Default Image";
      default:
        return "Image";
    }
  };

  return (
    <div className="grid grid-cols-4 items-start gap-4">
      <Label htmlFor="image" className="text-right pt-2">
        {getImageLabelText()}
      </Label>
      <div className="col-span-3">
        {file || imageURL ? (
          <div className="relative">
            <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-muted/20">
              {file ? (
                <img
                  src={URL.createObjectURL(file)}
                  alt="Upload preview"
                  className="h-full w-full object-contain"
                />
              ) : imageURL ? (
                <img
                  src={imageURL}
                  alt="Existing image"
                  className="h-full w-full object-contain"
                />
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-background border border-border"
              onClick={removeFile}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div
            className={`relative flex aspect-video cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed ${
              dragOver ? "border-warm-gold bg-warm-gold/5" : "border-border bg-muted/10"
            } px-6 py-8 text-center transition-colors duration-200`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => document.getElementById("image")?.click()}
          >
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warm-gold/10">
                <ImagePlus className="h-6 w-6 text-warm-gold" />
              </div>
              <div className="flex flex-col space-y-1">
                <span className="text-sm font-medium">
                  Drag & drop or click to upload
                </span>
                <span className="text-xs text-muted-foreground">
                  Supports JPEG, PNG, GIF up to 10MB
                </span>
              </div>
            </div>
            <input
              id="image"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleFileChange}
            />
          </div>
        )}
      </div>
    </div>
  );
};
