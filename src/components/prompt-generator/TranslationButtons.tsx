import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Languages, ArrowLeftRight, Loader2, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { callEdgeFunction } from "@/utils/edgeFunctions";

interface TranslationButtonsProps {
  text: string;
  onTranslated: (translatedText: string) => void;
  onTranslationStored?: (translations: { arabic?: string; english?: string }) => void;
}

export function TranslationButtons({ text, onTranslated, onTranslationStored }: TranslationButtonsProps) {
  const { toast } = useToast();
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [translationDirection, setTranslationDirection] = useState<'ar-en' | 'en-ar' | null>(null);
  const [copied, setCopied] = useState(false);
  const [storedTranslations, setStoredTranslations] = useState<{ arabic?: string; english?: string }>({});

  const detectLanguage = (text: string): 'ar' | 'en' => {
    // Simple language detection based on Arabic characters
    const arabicRegex = /[\u0600-\u06FF]/;
    return arabicRegex.test(text) ? 'ar' : 'en';
  };

  const translateText = async (direction: 'ar-en' | 'en-ar') => {
    if (!text.trim()) {
      toast({
        variant: "destructive",
        title: "No text to translate",
        description: "Please enter some text before translating."
      });
      return;
    }

    setIsTranslating(true);
    setTranslationDirection(direction);

    try {
      const [sourceLanguage, targetLanguage] = direction.split('-');
      
      const response = await callEdgeFunction('translate-text', {
        text: text.trim(),
        targetLanguage,
        sourceLanguage
      });

      if (response.translatedText) {
        setTranslatedText(response.translatedText);
        
        // Store translation in metadata
        const newTranslations = {
          ...storedTranslations,
          [targetLanguage === 'ar' ? 'arabic' : 'english']: response.translatedText
        };
        setStoredTranslations(newTranslations);
        onTranslationStored?.(newTranslations);
        
        toast({
          title: "Translation completed",
          description: `Text translated from ${sourceLanguage.toUpperCase()} to ${targetLanguage.toUpperCase()}.`
        });
      } else {
        throw new Error("Translation failed");
      }
    } catch (error) {
      console.error("Translation error:", error);
      toast({
        variant: "destructive",
        title: "Translation failed",
        description: "Failed to translate text. Please try again."
      });
      setTranslatedText(null);
    } finally {
      setIsTranslating(false);
    }
  };

  const applyTranslation = () => {
    if (translatedText) {
      onTranslated(translatedText);
      setTranslatedText(null);
      setTranslationDirection(null);
      toast({
        title: "Translation applied",
        description: "The translated text has been applied to your prompt."
      });
    }
  };

  const copyTranslation = async () => {
    if (!translatedText) return;

    try {
      await navigator.clipboard.writeText(translatedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied!",
        description: "Translation copied to clipboard."
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Copy failed",
        description: "Failed to copy translation."
      });
    }
  };

  const detectedLanguage = text.trim() ? detectLanguage(text) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Languages className="h-4 w-4 text-warm-gold" />
        <Label className="text-sm font-medium">Translation</Label>
      </div>

      {/* Translation Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={() => translateText('ar-en')}
          disabled={isTranslating || !text.trim()}
          variant="outline"
          className="flex-1"
        >
          {isTranslating && translationDirection === 'ar-en' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Translating...
            </>
          ) : (
            <>
              <span className="font-arabic text-sm mr-2">ع</span>
              <ArrowLeftRight className="h-3 w-3 mx-1" />
              <span className="text-sm">EN</span>
            </>
          )}
        </Button>

        <Button
          onClick={() => translateText('en-ar')}
          disabled={isTranslating || !text.trim()}
          variant="outline"
          className="flex-1"
        >
          {isTranslating && translationDirection === 'en-ar' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Translating...
            </>
          ) : (
            <>
              <span className="text-sm mr-2">EN</span>
              <ArrowLeftRight className="h-3 w-3 mx-1" />
              <span className="font-arabic text-sm">ع</span>
            </>
          )}
        </Button>
      </div>

      {/* Language Detection Info */}
      {detectedLanguage && (
        <p className="text-xs text-muted-foreground">
          Detected language: {detectedLanguage === 'ar' ? 'Arabic (العربية)' : 'English'}
        </p>
      )}

      {/* Translation Result */}
      {translatedText && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Languages className="h-4 w-4 text-warm-gold" />
              Translation Result
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-muted rounded-lg border">
              <p className="text-sm" dir={translationDirection === 'en-ar' ? 'rtl' : 'ltr'}>
                {translatedText}
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={applyTranslation}
                className="mobile-button-primary flex-1"
                size="sm"
              >
                Apply Translation
              </Button>
              
              <Button
                onClick={copyTranslation}
                variant="outline"
                size="sm"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 mr-2" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 mr-2" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!text.trim() && (
        <p className="text-xs text-muted-foreground">
          Enter your prompt text above to enable translation between Arabic and English.
        </p>
      )}
    </div>
  );
}