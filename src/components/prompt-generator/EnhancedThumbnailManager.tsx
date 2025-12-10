import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Upload, Image as ImageIcon, X, Database, Crop, Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createLogger } from '@/utils/logging';

const logger = createLogger('ENHANCED_THUMBNAIL_MANAGER');

interface ThumbnailManagerProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

interface DatabaseImage {
  id: string;
  url: string;
  name: string;
  path: string;
}

export function ThumbnailManager({ value, onChange }: ThumbnailManagerProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(value);
  const [isUploading, setIsUploading] = useState(false);
  const [databaseImages, setDatabaseImages] = useState<DatabaseImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Load database images
  useEffect(() => {
    loadDatabaseImages();
  }, []);

  const loadDatabaseImages = async () => {
    setLoadingImages(true);
    try {
      // Get images from prompt-images bucket
      const { data: files, error } = await supabase.storage
        .from('prompt-images')
        .list('', { limit: 50 });

      if (error) throw error;

      const imageList: DatabaseImage[] = [];
      
      for (const file of files || []) {
        if (file.name.match(/\.(jpg|jpeg|png|webp)$/i)) {
          const { data: urlData } = supabase.storage
            .from('prompt-images')
            .getPublicUrl(file.name);
          
          imageList.push({
            id: file.id || file.name,
            url: urlData.publicUrl,
            name: file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, ' '),
            path: file.name
          });
        }
      }

      // Also get default images
      const { data: defaultFiles, error: defaultError } = await supabase.storage
        .from('default-prompt-images')
        .list('', { limit: 50 });

      if (!defaultError && defaultFiles) {
        for (const file of defaultFiles) {
          if (file.name.match(/\.(jpg|jpeg|png|webp)$/i)) {
            const { data: urlData } = supabase.storage
              .from('default-prompt-images')
              .getPublicUrl(file.name);
            
            imageList.push({
              id: `default-${file.id || file.name}`,
              url: urlData.publicUrl,
              name: `Default: ${file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, ' ')}`,
              path: file.name
            });
          }
        }
      }

      setDatabaseImages(imageList);
    } catch (error: any) {
      logger.error('Error loading database images', { error: error.message });
      toast({
        variant: "destructive",
        title: "Failed to load images",
        description: "Could not load images from database."
      });
    } finally {
      setLoadingImages(false);
    }
  };

  const generateUniqueFileName = (originalName: string): string => {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const extension = originalName.split('.').pop();
    return `thumb_${timestamp}_${randomStr}.${extension}`;
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

    setSelectedFile(file);
    setShowCropDialog(true);
  };

  const uploadToStorage = async (file: File, shouldCrop: boolean = false) => {
    setIsUploading(true);
    try {
      const fileName = generateUniqueFileName(file.name);
      
      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from('prompt-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('prompt-images')
        .getPublicUrl(fileName);

      setPreviewUrl(urlData.publicUrl);
      onChange(urlData.publicUrl);
      
      toast({
        title: "Image uploaded",
        description: "Thumbnail has been uploaded successfully."
      });

      // Refresh database images
      loadDatabaseImages();
      
    } catch (error: any) {
      logger.error('Upload error', { error: error.message });
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: "Failed to upload image. Please try again."
      });
    } finally {
      setIsUploading(false);
      setShowCropDialog(false);
      setSelectedFile(null);
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
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    onChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
}
  };

  const filteredImages = databaseImages.filter(image =>
    image.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
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
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Uploading...
                  </>
                ) : (
                  "Choose File"
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="database" className="space-y-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search images..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {loadingImages ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-warm-gold" />
                <span className="ml-2 text-sm text-muted-foreground">Loading images...</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-64 overflow-y-auto">
                {filteredImages.map((image) => (
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
                        loading="lazy"
                      />
                      <p className="text-xs text-center mt-2 text-muted-foreground truncate">
                        {image.name}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            
            {filteredImages.length === 0 && !loadingImages && (
              <p className="text-xs text-muted-foreground text-center py-8">
                {searchQuery ? 'No images found matching your search.' : 'No images available in database.'}
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Crop Dialog */}
      <Dialog open={showCropDialog} onOpenChange={setShowCropDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crop className="h-5 w-5" />
              Upload Image
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedFile && (
              <div className="text-center">
                <img
                  src={URL.createObjectURL(selectedFile)}
                  alt="Preview"
                  className="max-w-full max-h-48 mx-auto rounded border"
                />
                <p className="text-sm text-muted-foreground mt-2">
                  {selectedFile.name}
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                onClick={() => selectedFile && uploadToStorage(selectedFile, false)}
                disabled={isUploading}
                className="flex-1"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Uploading...
                  </>
                ) : (
                  "Upload as is"
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCropDialog(false)}
                disabled={isUploading}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { ThumbnailManager as EnhancedThumbnailManager };