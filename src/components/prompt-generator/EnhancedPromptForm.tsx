import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Save, FileText, Loader2, Clock, Copy, Share2, AlertCircle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PromptTypeSelector } from "./PromptTypeSelector";
import { CategorySelector } from "./CategorySelector";
import { ThumbnailManager } from "./ThumbnailManager";
import { TagsManager } from "./TagsManager";
import { TranslationButtons } from "./TranslationButtons";
import { SmartSuggestions } from "./SmartSuggestions";
import { PromptPreview } from "./PromptPreview";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useFormValidation } from "@/hooks/useFormValidation";

interface PromptFormData {
  title: string;
  promptText: string;
  promptType: string;
  category: string;
  thumbnail: string | null;
  tags: string[];
  translations: { arabic?: string; english?: string };
}

export function EnhancedPromptForm() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<PromptFormData>({
    title: "",
    promptText: "",
    promptType: "",
    category: "",
    thumbnail: null,
    tags: [],
    translations: {}
  });

  // Validation
  const { validationErrors, isValid } = useFormValidation(formData);

  // Auto-save functionality
  const savePromptToDatabase = async (data: PromptFormData) => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      throw new Error("User not authenticated");
    }

    const promptData = {
      title: data.title,
      prompt_text: data.promptText,
      prompt_type: data.promptType,
      user_id: userData.user.id,
      image_path: data.thumbnail,
      metadata: {
        category: data.category,
        tags: data.tags,
        translations: data.translations,
        created_via: "enhanced_prompt_generator"
      }
    };

    const { error } = await supabase
      .from('prompts')
      .insert([promptData]);

    if (error) throw error;
  };

  const { lastSaved, isSaving, hasChanges, clearDraft, manualSave } = useAutoSave({
    formData,
    isValid,
    onSave: savePromptToDatabase
  });

  // Load draft from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem('prompt-draft');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setFormData(parsed);
        toast({
          title: "Draft loaded",
          description: "Your previous work has been restored.",
        });
      } catch (error) {
        console.error("Failed to load draft:", error);
      }
    }
  }, [toast]);

  const handleSubmit = async () => {
    if (!isValid) {
      toast({
        variant: "destructive",
        title: "Validation failed",
        description: "Please fix the errors before saving."
      });
      return;
    }

    setIsLoading(true);
    try {
      await savePromptToDatabase(formData);
      
      toast({
        title: "Prompt saved!",
        description: "Your prompt has been saved successfully."
      });
      
      // Reset form and clear draft
      setFormData({
        title: "",
        promptText: "",
        promptType: "",
        category: "",
        thumbnail: null,
        tags: [],
        translations: {}
      });
      clearDraft();
      
    } catch (error) {
      console.error("Error saving prompt:", error);
      toast({
        variant: "destructive",
        title: "Save failed",
        description: "Failed to save prompt. Please try again."
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAndCopy = async () => {
    await handleSubmit();
    if (formData.promptText) {
      try {
        await navigator.clipboard.writeText(formData.promptText);
        toast({
          title: "Copied!",
          description: "Prompt text copied to clipboard."
        });
      } catch (error) {
        // Copy failed, but prompt was saved
      }
    }
  };

  const handleSaveAndShare = async () => {
    await handleSubmit();
    if (navigator.share && formData.title && formData.promptText) {
      try {
        await navigator.share({
          title: formData.title,
          text: formData.promptText,
        });
      } catch (error) {
        // Share failed or user canceled
      }
    }
  };

  const updateFormData = (field: keyof PromptFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card className="border-0 shadow-none">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-dark-base">
            <FileText className="h-5 w-5 text-warm-gold" />
            Create New Prompt
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Auto-save status */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {isSaving ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving...
                </>
              ) : lastSaved ? (
                <>
                  <Clock className="h-3 w-3" />
                  Saved {lastSaved.toLocaleTimeString()}
                </>
              ) : hasChanges ? (
                <>
                  <AlertCircle className="h-3 w-3 text-amber-500" />
                  Unsaved changes
                </>
              ) : (
                <>
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  All saved
                </>
              )}
            </div>
            <PromptPreview formData={formData} validationErrors={validationErrors} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <Card className="border-l-4 border-l-red-500 bg-red-50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-red-600 mb-2">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Please fix these issues:</span>
              </div>
              <ul className="text-sm text-red-600 space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Title Field */}
        <div className="space-y-2">
          <Label htmlFor="title" className="text-sm font-medium">
            Title *
          </Label>
          <Input
            id="title"
            placeholder="Enter prompt title..."
            value={formData.title}
            onChange={(e) => updateFormData("title", e.target.value)}
            className={`w-full ${!formData.title.trim() && validationErrors.some(e => e.includes('Title')) ? 'border-red-500' : ''}`}
          />
          <div className="text-xs text-muted-foreground">
            {formData.title.length}/100 characters
          </div>
        </div>

        {/* Prompt Text Field */}
        <div className="space-y-2">
          <Label htmlFor="prompt-text" className="text-sm font-medium">
            Prompt Text *
          </Label>
          <Textarea
            id="prompt-text"
            placeholder="Enter your prompt here..."
            value={formData.promptText}
            onChange={(e) => updateFormData("promptText", e.target.value)}
            className={`min-h-[120px] w-full ${!formData.promptText.trim() && validationErrors.some(e => e.includes('Prompt text')) ? 'border-red-500' : ''}`}
          />
          <div className="text-xs text-muted-foreground">
            {formData.promptText.length}/5000 characters • {formData.promptText.split(/\s+/).filter(Boolean).length} words
          </div>
        </div>

        <Separator />

        {/* Type and Category Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PromptTypeSelector
            value={formData.promptType}
            onChange={(value) => updateFormData("promptType", value)}
          />
          <CategorySelector
            value={formData.category}
            onChange={(value) => updateFormData("category", value)}
          />
        </div>

        <Separator />

        {/* Enhanced Thumbnail Manager */}
        <ThumbnailManager
          value={formData.thumbnail}
          onChange={(value) => updateFormData("thumbnail", value)}
        />

        <Separator />

        {/* AI Generated Tags */}
        <TagsManager
          promptText={formData.promptText}
          tags={formData.tags}
          onChange={(tags) => updateFormData("tags", tags)}
        />

        <Separator />

        {/* Translation Buttons */}
        <TranslationButtons
          text={formData.promptText}
          onTranslated={(translatedText) => updateFormData("promptText", translatedText)}
          onTranslationStored={(translations) => updateFormData("translations", translations)}
        />

        <Separator />

        {/* Smart Suggestions */}
        <SmartSuggestions
          promptText={formData.promptText}
          currentCategory={formData.category}
          currentType={formData.promptType}
          onCategorySelect={(category) => updateFormData("category", category)}
          onTypeSelect={(type) => updateFormData("promptType", type)}
        />

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4">
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !isValid}
            className="mobile-button-primary"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Prompt
              </>
            )}
          </Button>

          <Button
            onClick={handleSaveAndCopy}
            disabled={isLoading || !isValid}
            variant="outline"
            size="lg"
          >
            <Copy className="h-4 w-4 mr-2" />
            Save & Copy
          </Button>

          <Button
            onClick={handleSaveAndShare}
            disabled={isLoading || !isValid}
            variant="outline"
            size="lg"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Save & Share
          </Button>
        </div>

        {/* Tags Display */}
        {formData.tags.length > 0 && (
          <div className="pt-2">
            <div className="flex flex-wrap gap-2">
              {formData.tags.map((tag, index) => (
                <Badge key={index} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}