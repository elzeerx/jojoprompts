
import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { getPromptImage } from "@/utils/image";
import { Upload, Link, Database, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { createLogger } from '@/utils/logging';
import { handleError } from '@/utils/errorHandler';

const logger = createLogger('IMAGE_SELECTION');

interface ImageSelectionFieldProps {
  currentImagePath?: string;
  onImagePathChange: (path: string) => void;
  onFileChange: (file: File) => void;
  label?: string;
}

interface DatabaseImage {
  id: string;
  title: string;
  image_path: string;
  image_url?: string;
}

export function ImageSelectionField({ 
  currentImagePath, 
  onImagePathChange, 
  onFileChange,
  label = "Prompt Image"
}: ImageSelectionFieldProps) {
  const [databaseImages, setDatabaseImages] = useState<DatabaseImage[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [selectedDatabaseImage, setSelectedDatabaseImage] = useState<string>("");
  const [urlInput, setUrlInput] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string>("");

  // Load database images
  useEffect(() => {
    loadDatabaseImages();
  }, []);

  // Update preview when current image path changes
  useEffect(() => {
    if (currentImagePath) {
      if (currentImagePath.startsWith('http')) {
        setPreviewUrl(currentImagePath);
      } else {
        getPromptImage(currentImagePath).then(setPreviewUrl);
      }
    } else {
      setPreviewUrl("");
    }
  }, [currentImagePath]);

  const loadDatabaseImages = async () => {
    setIsLoadingImages(true);
    try {
      const { data, error } = await supabase
        .from('prompts')
        .select('id, title, image_path')
        .not('image_path', 'is', null)
        .limit(20)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const imagesWithUrls = await Promise.all(
        (data || []).map(async (prompt) => {
          const imageUrl = await getPromptImage(prompt.image_path);
          return {
            ...prompt,
            image_url: imageUrl
          };
        })
      );

      setDatabaseImages(imagesWithUrls);
    } catch (error) {
      const appError = handleError(error, { component: 'ImageSelectionField', action: 'loadImages' });
      logger.error('Error loading database images', { error: appError });
      toast({
        title: "Error",
        description: "Failed to load database images",
        variant: "destructive"
      });
    } finally {
      setIsLoadingImages(false);
    }
  };

  const handleDatabaseImageSelect = (imagePath: string) => {
    setSelectedDatabaseImage(imagePath);
    onImagePathChange(imagePath);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileChange(file);
      // Create preview URL for the uploaded file
      const fileUrl = URL.createObjectURL(file);
      setPreviewUrl(fileUrl);
    }
  };

  const handleUrlSubmit = () => {
    if (urlInput && urlInput.startsWith('http')) {
      onImagePathChange(urlInput);
      setPreviewUrl(urlInput);
      toast({
        title: "Success",
        description: "Image URL set successfully"
      });
    } else {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid HTTP/HTTPS URL",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">{label}</Label>
      
      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="database" className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            Database
          </TabsTrigger>
          <TabsTrigger value="url" className="flex items-center gap-2">
            <Link className="w-4 h-4" />
            URL
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
            <div className="text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div className="mt-4">
                <Label htmlFor="image-upload" className="cursor-pointer">
                  <span className="mt-2 block text-sm font-medium text-gray-900">
                    Click to upload an image
                  </span>
                  <span className="mt-1 block text-xs text-gray-500">
                    PNG, JPG, GIF up to 10MB
                  </span>
                </Label>
                <Input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="database" className="space-y-4">
          <div className="max-h-96 overflow-y-auto">
            {isLoadingImages ? (
              <div className="text-center py-4">Loading images...</div>
            ) : databaseImages.length === 0 ? (
              <div className="text-center py-4 text-gray-500">No images found in database</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {databaseImages.map((image) => (
                  <Card 
                    key={image.id} 
                    className={`cursor-pointer transition-all hover:ring-2 hover:ring-blue-500 ${
                      selectedDatabaseImage === image.image_path ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => handleDatabaseImageSelect(image.image_path)}
                  >
                    <CardContent className="p-2">
                      <div className="aspect-square relative">
                        <img
                          src={image.image_url}
                          alt={image.title}
                          className="w-full h-full object-cover rounded"
                        />
                        {selectedDatabaseImage === image.image_path && (
                          <div className="absolute top-1 right-1 bg-blue-500 text-white rounded-full p-1">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-1 truncate">{image.title}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="url" className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="https://example.com/image.jpg"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleUrlSubmit} type="button">
              Set URL
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Enter a direct URL to an image (must start with http:// or https://)
          </p>
        </TabsContent>
      </Tabs>

      {/* Image Preview */}
      {previewUrl && (
        <div className="mt-4">
          <Label className="text-sm font-medium">Preview:</Label>
          <div className="mt-2">
            <img
              src={previewUrl}
              alt="Selected image preview"
              className="w-32 h-32 object-cover rounded-lg border"
            />
          </div>
        </div>
      )}
    </div>
  );
}
