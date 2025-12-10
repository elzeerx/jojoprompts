import React, { useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Languages, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { createLogger } from '@/utils/logging';
import { handleError } from '@/utils/errorHandler';

const logger = createLogger('BILINGUAL_FIELDS');

interface BilingualFieldsProps {
  title: { en: string; ar: string };
  promptText: { en: string; ar: string };
  onTitleChange: (title: { en: string; ar: string }) => void;
  onPromptTextChange: (promptText: { en: string; ar: string }) => void;
}

export function BilingualFields({ 
  title, 
  promptText, 
  onTitleChange, 
  onPromptTextChange 
}: BilingualFieldsProps) {
  const [activeTab, setActiveTab] = useState<"en" | "ar">("en");
  const [isTranslating, setIsTranslating] = useState(false);

  const translateText = useCallback(async (text: string, targetLanguage: 'ar' | 'en') => {
    if (!text.trim()) {
      toast({
        title: "Translation Error",
        description: "Please enter some text to translate",
        variant: "destructive"
      });
      return null;
    }

    setIsTranslating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('translate-text', {
        body: {
          text: text,
          targetLanguage: targetLanguage,
          sourceLanguage: targetLanguage === 'ar' ? 'en' : 'ar'
        }
      });

      if (error) throw error;
      
      return data.translatedText;
    } catch (error) {
      const appError = handleError(error, { component: 'BilingualFields', action: 'translate' });
      logger.error('Translation failed', { error: appError, targetLanguage });
      toast({
        title: "Translation Failed",
        description: "Failed to translate text. Please try again.",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsTranslating(false);
    }
  }, []);

  const handleAutoTranslate = async (field: 'title' | 'promptText', direction: 'en-to-ar' | 'ar-to-en') => {
    const sourceText = direction === 'en-to-ar' 
      ? (field === 'title' ? title.en : promptText.en)
      : (field === 'title' ? title.ar : promptText.ar);
    
    const targetLang = direction === 'en-to-ar' ? 'ar' : 'en';
    
    const translatedText = await translateText(sourceText, targetLang);
    
    if (translatedText) {
      if (field === 'title') {
        onTitleChange({
          ...title,
          [targetLang]: translatedText
        });
      } else {
        onPromptTextChange({
          ...promptText,
          [targetLang]: translatedText
        });
      }
      
      toast({
        title: "Translation Complete",
        description: `Text translated to ${targetLang === 'ar' ? 'Arabic' : 'English'}`,
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Languages className="h-5 w-5 text-[var(--warm-gold)]" />
        <Label className="text-base font-semibold">Bilingual Content</Label>
        <span className="text-sm text-muted-foreground">
          (Support for English and Arabic)
        </span>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "en" | "ar")}>
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="en" className="flex items-center gap-2">
            🇺🇸 English
          </TabsTrigger>
          <TabsTrigger value="ar" className="flex items-center gap-2">
            🇸🇦 العربية
          </TabsTrigger>
        </TabsList>

        {/* English Tab */}
        <TabsContent value="en" className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="title-en">Title (English)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAutoTranslate('title', 'en-to-ar')}
                disabled={isTranslating || !title.en.trim()}
                className="text-xs"
              >
                {isTranslating ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Languages className="h-3 w-3 mr-1" />
                )}
                Translate to Arabic
              </Button>
            </div>
            <Input
              id="title-en"
              value={title.en}
              onChange={(e) => onTitleChange({ ...title, en: e.target.value })}
              placeholder="Enter prompt title in English"
              className="text-left"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="prompt-en">Prompt Text (English)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAutoTranslate('promptText', 'en-to-ar')}
                disabled={isTranslating || !promptText.en.trim()}
                className="text-xs"
              >
                {isTranslating ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Languages className="h-3 w-3 mr-1" />
                )}
                Translate to Arabic
              </Button>
            </div>
            <Textarea
              id="prompt-en"
              value={promptText.en}
              onChange={(e) => onPromptTextChange({ ...promptText, en: e.target.value })}
              placeholder="Enter your prompt in English"
              rows={4}
              className="text-left resize-none"
            />
          </div>
        </TabsContent>

        {/* Arabic Tab */}
        <TabsContent value="ar" className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="title-ar">العنوان (العربية)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAutoTranslate('title', 'ar-to-en')}
                disabled={isTranslating || !title.ar.trim()}
                className="text-xs"
              >
                {isTranslating ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Languages className="h-3 w-3 mr-1" />
                )}
                Translate to English
              </Button>
            </div>
            <Input
              id="title-ar"
              value={title.ar}
              onChange={(e) => onTitleChange({ ...title, ar: e.target.value })}
              placeholder="أدخل عنوان البرومبت باللغة العربية"
              className="text-right"
              dir="rtl"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="prompt-ar">نص البرومبت (العربية)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAutoTranslate('promptText', 'ar-to-en')}
                disabled={isTranslating || !promptText.ar.trim()}
                className="text-xs"
              >
                {isTranslating ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Languages className="h-3 w-3 mr-1" />
                )}
                Translate to English
              </Button>
            </div>
            <Textarea
              id="prompt-ar"
              value={promptText.ar}
              onChange={(e) => onPromptTextChange({ ...promptText, ar: e.target.value })}
              placeholder="أدخل النص الخاص بك باللغة العربية"
              rows={4}
              className="text-right resize-none"
              dir="rtl"
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}