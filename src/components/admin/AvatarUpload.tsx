import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Link, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface AvatarUploadProps {
  currentAvatarUrl?: string | null;
  userId: string;
  userName: string;
  onAvatarChange: (url: string | null) => void;
  disabled?: boolean;
}

export function AvatarUpload({
  currentAvatarUrl,
  userId,
  userName,
  onAvatarChange,
  disabled = false
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('prompt-images')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from('prompt-images')
        .getPublicUrl(filePath);

      onAvatarChange(data.publicUrl);
      toast({
        title: "Success",
        description: "Avatar uploaded successfully."
      });
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload avatar.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please select an image file.",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive"
      });
      return;
    }

    uploadFile(file);
  };

  const handleUrlSubmit = () => {
    if (!urlInput) return;
    
    try {
      new URL(urlInput); // Validate URL format
      onAvatarChange(urlInput);
      setUrlInput("");
      toast({
        title: "Success",
        description: "Avatar URL updated successfully."
      });
    } catch (error) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid image URL.",
        variant: "destructive"
      });
    }
  };

  const handleRemoveAvatar = () => {
    onAvatarChange(null);
    toast({
      title: "Success",
      description: "Avatar removed successfully."
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar className="h-20 w-20">
          <AvatarImage src={currentAvatarUrl || undefined} />
          <AvatarFallback className="text-lg">
            {getInitials(userName)}
          </AvatarFallback>
        </Avatar>
        
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || disabled}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
            
            {currentAvatarUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemoveAvatar}
                disabled={disabled}
                className="flex items-center gap-2 text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </Button>
            )}
          </div>
          
          <p className="text-xs text-muted-foreground">
            Upload an image or enter a URL below. Max 5MB.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="avatarUrl">Or enter image URL</Label>
        <div className="flex gap-2">
          <Input
            id="avatarUrl"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example.com/image.jpg"
            disabled={disabled}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleUrlSubmit}
            disabled={!urlInput || disabled}
            className="flex items-center gap-2"
          >
            <Link className="h-4 w-4" />
            Set
          </Button>
        </div>
      </div>

      <Input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}