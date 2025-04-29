
import React, { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageIcon, UploadIcon } from "lucide-react";
import { getPromptImage } from "@/utils/image";

interface ImageUploadFieldProps {
  imageURL: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  promptType: "text" | "image";
}

export const ImageUploadField: React.FC<ImageUploadFieldProps> = ({
  imageURL,
  file,
  onFileChange,
  promptType,
}) => {
  const [showImageSelector, setShowImageSelector] = useState(false);
  const [existingImages, setExistingImages] = useState<{ path: string; url: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const bucketName = promptType === "text" ? "default-prompt-images" : "prompt-images";

  const fetchExistingImages = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.storage.from(bucketName).list();
      
      if (error) {
        console.error(`Error fetching images from ${bucketName}:`, error);
        return;
      }

      const imageFiles = data
        .filter(file => !file.metadata.isDirectory)
        .filter(file => {
          const ext = file.name.split('.').pop()?.toLowerCase();
          return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
        });

      const imagesWithUrls = await Promise.all(
        imageFiles.map(async (file) => {
          let url;
          try {
            url = await getPromptImage(file.name, 200, 80);
          } catch (err) {
            console.error(`Error generating URL for ${file.name}:`, err);
            url = '/img/placeholder.png';
          }
          return { path: file.name, url };
        })
      );

      setExistingImages(imagesWithUrls);
    } catch (err) {
      console.error(`Error in fetchExistingImages for ${bucketName}:`, err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectExistingImage = async (path: string) => {
    setSelectedImage(path);
    onFileChange(null); // Clear any uploaded file
    setShowImageSelector(false);
  };

  useEffect(() => {
    if (showImageSelector) {
      fetchExistingImages();
    }
  }, [showImageSelector, bucketName]);

  return (
    <div className="grid grid-cols-4 items-center gap-4">
      <Label htmlFor="image" className="text-right">
        Image
      </Label>
      <div className="col-span-3 space-y-4">
        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">
              <UploadIcon className="mr-2 h-4 w-4" /> Upload
            </TabsTrigger>
            <TabsTrigger value="select">
              <ImageIcon className="mr-2 h-4 w-4" /> Select Existing
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload">
            <Input
              type="file"
              id="image"
              accept="image/*"
              onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
              className="cursor-pointer"
            />
          </TabsContent>
          
          <TabsContent value="select">
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setShowImageSelector(true)}
            >
              Browse Existing Images
            </Button>
          </TabsContent>
        </Tabs>

        {(imageURL || file || selectedImage) && (
          <div className="rounded-lg overflow-hidden bg-muted">
            {file ? (
              <img
                src={URL.createObjectURL(file)}
                alt="Preview"
                className="w-full aspect-video object-cover"
              />
            ) : selectedImage ? (
              <img
                src={existingImages.find(img => img.path === selectedImage)?.url || imageURL}
                alt="Selected image"
                className="w-full aspect-video object-cover"
              />
            ) : (
              <img
                src={imageURL}
                alt="Preview"
                className="w-full aspect-video object-cover"
              />
            )}
          </div>
        )}

        {/* Image Selection Dialog */}
        <Dialog open={showImageSelector} onOpenChange={setShowImageSelector}>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Select an Image</DialogTitle>
            </DialogHeader>
            <ScrollArea className="h-[50vh]">
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <p>Loading images...</p>
                </div>
              ) : existingImages.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <p>No images found</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4">
                  {existingImages.map((image) => (
                    <div
                      key={image.path}
                      className={`
                        cursor-pointer rounded-md overflow-hidden border-2 
                        ${selectedImage === image.path ? 'border-primary' : 'border-transparent'}
                        hover:border-primary/50 transition-all
                      `}
                      onClick={() => handleSelectExistingImage(image.path)}
                    >
                      <img
                        src={image.url}
                        alt={image.path}
                        className="w-full h-32 object-cover"
                      />
                      <div className="p-2 text-xs truncate bg-muted/50">
                        {image.path}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
