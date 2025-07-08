import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Link, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ImageUploadProps {
  value?: string;
  onChange: (value: string) => void;
  label: string;
  accept?: string;
  placeholder?: string;
}

export function ImageUpload({ 
  value = "", 
  onChange, 
  label, 
  accept = "image/*",
  placeholder = "Enter image URL or upload a file"
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [urlValue, setUrlValue] = useState(value.startsWith('http') ? value : '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      // Create a unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      
      // Upload to storage.bucket (the public bucket)
      const { data, error } = await supabase.storage
        .from('storage.bucket')
        .upload(fileName, file);

      if (error) {
        throw error;
      }

      // Get the public URL for the uploaded file
      const { data: { publicUrl } } = supabase.storage
        .from('storage.bucket')
        .getPublicUrl(fileName);
      
      onChange(publicUrl);
      
      toast({
        title: "Image uploaded",
        description: "Image has been uploaded successfully",
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleUrlSubmit = () => {
    if (urlValue.trim()) {
      onChange(urlValue.trim());
      toast({
        title: "URL added",
        description: "Image URL has been set successfully",
      });
    }
  };

  const clearValue = () => {
    onChange('');
    setUrlValue('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      
      {value && (
        <div className="relative">
          <div className="flex items-center justify-between p-2 bg-muted rounded border">
            <span className="text-sm truncate">{value}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearValue}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      <Tabs defaultValue="url" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="url" className="flex items-center gap-2">
            <Link className="h-4 w-4" />
            URL
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="url" className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              placeholder={placeholder}
              type="url"
            />
            <Button 
              type="button" 
              onClick={handleUrlSubmit}
              disabled={!urlValue.trim()}
            >
              Set URL
            </Button>
          </div>
        </TabsContent>
        
        <TabsContent value="upload" className="space-y-2">
          <div className="flex items-center gap-2">
            <Input
              ref={fileInputRef}
              type="file"
              accept={accept}
              onChange={handleFileSelect}
              disabled={uploading}
              className="file:mr-2 file:px-2 file:py-1 file:rounded file:border-0 file:text-sm file:bg-muted file:text-muted-foreground"
            />
            <Button 
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? "Uploading..." : "Browse"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}