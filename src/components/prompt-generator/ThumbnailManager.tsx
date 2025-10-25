import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Image as ImageIcon, X, Database, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getPromptImage } from "@/utils/image";
import { createLogger } from '@/utils/logging';

const logger = createLogger('THUMBNAIL_MANAGER');

interface ThumbnailManagerProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

// Mock database images for demo
const databaseImages = [
  { id: "1", url: "/placeholder.svg", name: "Default Image 1" },
  { id: "2", url: "/placeholder.svg", name: "Default Image 2" },
  { id: "3", url: "/placeholder.svg", name: "Default Image 3" },
  { id: "4", url: "/placeholder.svg", name: "Default Image 4" },
];

export function ThumbnailManager({ value, onChange }: ThumbnailManagerProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Load preview URL when value changes (for editing existing prompts)
  useEffect(() => {
    const loadPreview = async () => {
      if (value) {
        // If it's already a full URL, use it directly
        if (value.startsWith('http://') || value.startsWith('https://')) {
          setPreviewUrl(value);
        } else {
          // Otherwise, it's a storage path - get the signed URL
          try {
            const imageUrl = await getPromptImage(value, 400, 85);
            setPreviewUrl(imageUrl);
          } catch (error: any) {
            logger.error('Error loading preview', { error: error.message });
            setPreviewUrl(null);
          }
        }
      } else {
        setPreviewUrl(null);
      }
    };
    
    loadPreview();
  }, [value]);

  const generateUniqueFileName = (originalName: string): string => {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 11);
    const extension = originalName.split('.').pop();
    return `${timestamp}-${randomStr}.${extension}`;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        variant: "destructive",
        title: "Invalid file",
        description: "Please select an image file."
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File too large",
        description: "Please select an image smaller than 5MB."
      });
      return;
    }

    setIsUploading(true);
    try {
      // Generate unique filename
      const fileName = generateUniqueFileName(file.name);
      
      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from('prompt-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      // Get preview URL for display
      const imageUrl = await getPromptImage(fileName, 400, 85);
      setPreviewUrl(imageUrl);
      
      // Pass storage path (not URL) to parent
      onChange(fileName);
      
      toast({
        title: "Image uploaded",
        description: "Thumbnail has been uploaded successfully."
      });
      
    } catch (error: any) {
      logger.error('Upload error', { error: error.message });
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: "Failed to upload image. Please try again."
      });
    } finally {
      setIsUploading(false);
    }
  };

  const selectFromDatabase = (imageUrl: string) => {
    setPreviewUrl(imageUrl);
    onChange(imageUrl);
    toast({
      title: "Thumbnail selected",
      description: "Image selected from database."
    });
  };

  const removeThumbnail = () => {
    setPreviewUrl(null);
    onChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">Prompt Thumbnail</Label>
      
      {/* Current Thumbnail Preview */}
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <img
                  src={previewUrl}
                  alt="Thumbnail preview"
                  className="w-20 h-20 object-cover rounded-lg border"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6"
                  onClick={removeThumbnail}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Current thumbnail</p>
                <p className="text-xs text-muted-foreground">
                  Click the X to remove or choose a different image below
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Thumbnail Selection */}
      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="database" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            From Database
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-muted-foreground/50 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <ImageIcon className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm font-medium mb-2">Upload thumbnail image</p>
            <p className="text-xs text-muted-foreground mb-4">
              PNG, JPG, WEBP up to 5MB
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              variant="outline"
            >
              {isUploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isUploading ? "Uploading..." : "Choose File"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="database" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {databaseImages.map((image) => (
              <Card
                key={image.id}
                className="cursor-pointer hover:ring-2 hover:ring-warm-gold transition-all"
                onClick={() => selectFromDatabase(image.url)}
              >
                <CardContent className="p-3">
                  <img
                    src={image.url}
                    alt={image.name}
                    className="w-full aspect-square object-cover rounded border"
                  />
                  <p className="text-xs text-center mt-2 text-muted-foreground">
                    {image.name}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Click on an image to select it as thumbnail
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}