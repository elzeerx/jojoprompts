import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Eye, Copy, Share2, Save, FileText, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PromptPreviewProps {
  formData: {
    title: string;
    promptText: string;
    promptType: string;
    category: string;
    thumbnail: string | null;
    tags: string[];
    translations: { arabic?: string; english?: string };
  };
  validationErrors: string[];
}

export function PromptPreview({ formData, validationErrors }: PromptPreviewProps) {
  const { toast } = useToast();
  const [copySuccess, setCopySuccess] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(formData.promptText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
      toast({
        title: "Copied!",
        description: "Prompt text copied to clipboard."
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Copy failed",
        description: "Failed to copy to clipboard."
      });
    }
  };

  const sharePrompt = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: formData.title,
          text: formData.promptText,
        });
        toast({
          title: "Shared!",
          description: "Prompt shared successfully."
        });
      } catch (error) {
        // User canceled or error occurred
      }
    } else {
      // Fallback to copying URL
      copyToClipboard();
    }
  };

  const isValid = validationErrors.length === 0;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Eye className="h-4 w-4" />
          Preview
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Prompt Preview
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Validation Status */}
          <Card className={`border-l-4 ${isValid ? 'border-l-green-500' : 'border-l-red-500'}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                {isValid ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Ready to Save
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    Validation Issues
                  </>
                )}
              </CardTitle>
            </CardHeader>
            {!isValid && (
              <CardContent>
                <ul className="text-sm text-red-600 space-y-1">
                  {validationErrors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </CardContent>
            )}
          </Card>

          {/* Prompt Details */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{formData.title || "Untitled Prompt"}</CardTitle>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge variant="outline">{formData.promptType || "No type"}</Badge>
                    <Badge variant="secondary">{formData.category || "No category"}</Badge>
                  </div>
                </div>
                {formData.thumbnail && (
                  <img
                    src={formData.thumbnail}
                    alt="Thumbnail"
                    className="w-16 h-16 object-cover rounded-lg border"
                  />
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Prompt Text */}
              <div>
                <h4 className="text-sm font-medium mb-2">Prompt Text:</h4>
                <div className="p-3 bg-muted rounded-lg border">
                  <p className="text-sm whitespace-pre-wrap">
                    {formData.promptText || "No prompt text provided"}
                  </p>
                </div>
              </div>

              {/* Tags */}
              {formData.tags.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Tags:</h4>
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.map((tag, index) => (
                      <Badge key={index} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Translations */}
              {(formData.translations.arabic || formData.translations.english) && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Translations:</h4>
                  <div className="space-y-3">
                    {formData.translations.arabic && (
                      <div className="p-3 bg-muted rounded-lg border">
                        <p className="text-xs text-muted-foreground mb-1">Arabic:</p>
                        <p className="text-sm" dir="rtl">{formData.translations.arabic}</p>
                      </div>
                    )}
                    {formData.translations.english && (
                      <div className="p-3 bg-muted rounded-lg border">
                        <p className="text-xs text-muted-foreground mb-1">English:</p>
                        <p className="text-sm">{formData.translations.english}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Separator />

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  onClick={copyToClipboard}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  {copySuccess ? (
                    <CheckCircle className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copySuccess ? "Copied!" : "Copy Text"}
                </Button>
                
                <Button
                  onClick={sharePrompt}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Share2 className="h-3 w-3" />
                  Share
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Metadata</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Character count: {formData.promptText.length}</p>
                <p>Word count: {formData.promptText.split(/\s+/).filter(Boolean).length}</p>
                <p>Tags: {formData.tags.length}</p>
                <p>Has thumbnail: {formData.thumbnail ? "Yes" : "No"}</p>
                <p>Has translations: {Object.keys(formData.translations).length > 0 ? "Yes" : "No"}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}