import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Save, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PromptTypeSelector } from "./PromptTypeSelector";
import { CategorySelector } from "./CategorySelector";
import { ThumbnailManager } from "./ThumbnailManager";
import { TagsManager } from "./TagsManager";
import { TranslationButtons } from "./TranslationButtons";
import { SmartSuggestions } from "./SmartSuggestions";

interface PromptFormData {
  title: string;
  promptText: string;
  promptType: string;
  category: string;
  thumbnail: string | null;
  tags: string[];
  translations: { arabic?: string; english?: string };
}

export function SimplePromptForm() {
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

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.promptText.trim()) {
      toast({
        variant: "destructive",
        title: "Required fields missing",
        description: "Please fill in title and prompt text."
      });
      return;
    }

    setIsLoading(true);
    try {
      // TODO: Implement prompt saving logic
      console.log("Saving prompt:", formData);
      
      toast({
        title: "Prompt saved!",
        description: "Your prompt has been saved successfully."
      });
      
      // Reset form
      setFormData({
        title: "",
        promptText: "",
        promptType: "",
        category: "",
        thumbnail: null,
        tags: [],
        translations: {}
      });
      
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

  const updateFormData = (field: keyof PromptFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card className="border-0 shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-dark-base">
          <FileText className="h-5 w-5 text-warm-gold" />
          Create New Prompt
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
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
            className="w-full"
          />
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
            className="min-h-[120px] w-full"
          />
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

        {/* Thumbnail Manager */}
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

        {/* Submit Button */}
        <div className="pt-4">
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !formData.title.trim() || !formData.promptText.trim()}
            className="w-full mobile-button-primary"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving prompt...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Prompt
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}