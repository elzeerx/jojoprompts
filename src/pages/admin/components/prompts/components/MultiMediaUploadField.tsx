
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Upload, Image, Video, Volume2 } from "lucide-react";

interface MediaFile {
  type: 'image' | 'video' | 'audio';
  path: string;
  name: string;
  file?: File;
  preview?: string;
}

interface MultiMediaUploadFieldProps {
  mediaFiles: MediaFile[];
  onMediaFilesChange: (files: MediaFile[]) => void;
  onFilesChange: (files: File[]) => void;
}

export function MultiMediaUploadField({ 
  mediaFiles, 
  onMediaFilesChange, 
  onFilesChange 
}: MultiMediaUploadFieldProps) {
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newMediaFiles: MediaFile[] = files.map(file => {
      const type = file.type.startsWith('image/') ? 'image' 
                 : file.type.startsWith('video/') ? 'video'
                 : 'audio';
      
      const preview = type === 'image' ? URL.createObjectURL(file) : undefined;
      
      return {
        type,
        path: file.name,
        name: file.name,
        file,
        preview
      };
    });

    const updatedMediaFiles = [...mediaFiles, ...newMediaFiles];
    const updatedUploadFiles = [...uploadFiles, ...files];
    
    onMediaFilesChange(updatedMediaFiles);
    onFilesChange(updatedUploadFiles);
    setUploadFiles(updatedUploadFiles);
  };

  const removeMediaFile = (index: number) => {
    const updatedMediaFiles = mediaFiles.filter((_, i) => i !== index);
    const updatedUploadFiles = uploadFiles.filter((_, i) => i !== index);
    
    onMediaFilesChange(updatedMediaFiles);
    onFilesChange(updatedUploadFiles);
    setUploadFiles(updatedUploadFiles);
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <Image className="w-4 h-4" />;
      case 'video':
        return <Video className="w-4 h-4" />;
      case 'audio':
        return <Volume2 className="w-4 h-4" />;
      default:
        return <Upload className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">Media Files (Images, Videos, Audio)</Label>
      
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
        <div className="text-center">
          <Upload className="mx-auto h-12 w-12 text-gray-400" />
          <div className="mt-4">
            <Label htmlFor="media-upload" className="cursor-pointer">
              <span className="mt-2 block text-sm font-medium text-gray-900">
                Click to upload or drag and drop
              </span>
              <span className="mt-1 block text-xs text-gray-500">
                Images, Videos, or Audio files
              </span>
            </Label>
            <Input
              id="media-upload"
              type="file"
              multiple
              accept="image/*,video/*,audio/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {mediaFiles.length > 0 && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">Uploaded Files:</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {mediaFiles.map((media, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 border rounded-lg">
                <div className="flex-shrink-0">
                  {media.type === 'image' && media.preview ? (
                    <img
                      src={media.preview}
                      alt={media.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                      {getFileIcon(media.type)}
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {media.name}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">
                    {media.type}
                  </p>
                </div>
                
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMediaFile(index)}
                  className="flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
