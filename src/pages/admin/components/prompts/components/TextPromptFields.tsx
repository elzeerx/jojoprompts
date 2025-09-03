
import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe, Languages } from "lucide-react";
import { UseCaseField } from "./UseCaseField";
import { type PromptRow } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

interface TextPromptFieldsProps {
  metadata: PromptRow["metadata"];
  onMetadataChange: (metadata: PromptRow["metadata"]) => void;
  promptText: string;
  // Bilingual fields props
  titleEnglish?: string;
  titleArabic?: string;
  promptTextEnglish?: string;
  promptTextArabic?: string;
  onBilingualChange?: (field: string, value: string) => void;
}

export const TextPromptFields: React.FC<TextPromptFieldsProps> = ({
  metadata,
  onMetadataChange,
  promptText,
  titleEnglish,
  titleArabic,
  promptTextEnglish,
  promptTextArabic,
  onBilingualChange,
}) => {
  const { userRole } = useAuth();
  const canManagePrompts = userRole === 'admin' || userRole === 'prompter' || userRole === 'jadmin';

  return (
    <>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="target_model" className="text-right">
          Target Model
        </Label>
        <Select
          value={metadata.target_model}
          onValueChange={(value) =>
            onMetadataChange({ ...metadata, target_model: value })
          }
        >
          <SelectTrigger className="col-span-3">
            <SelectValue placeholder="Select target model" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gpt-4.1">GPT-4.1</SelectItem>
            <SelectItem value="gpt-4.1-mini">GPT-4.1 Mini</SelectItem>
            <SelectItem value="gpt-4.1-nano">GPT-4.1 Nano</SelectItem>
            <SelectItem value="gpt-4o">GPT-4o</SelectItem>
            <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
            <SelectItem value="o3">OpenAI o3</SelectItem>
            <SelectItem value="o4-mini">OpenAI o4-mini</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bilingual Fields for Admins/Prompters */}
      {canManagePrompts && (
        <Card className="border-dashed border-2 border-warm-gold/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Languages className="h-5 w-5 text-warm-gold" />
              Bilingual Content
            </CardTitle>
            <CardDescription>
              Add English and Arabic versions for better accessibility
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* English Fields */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Globe className="h-4 w-4" />
                English Version
              </div>
              <div className="space-y-2">
                <Label htmlFor="titleEnglish" className="text-sm">
                  Title (English)
                </Label>
                <Input
                  id="titleEnglish"
                  value={titleEnglish || ""}
                  onChange={(e) => onBilingualChange?.("titleEnglish", e.target.value)}
                  placeholder="Enter English title..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="promptTextEnglish" className="text-sm">
                  Prompt Text (English)
                </Label>
                <Textarea
                  id="promptTextEnglish"
                  value={promptTextEnglish || ""}
                  onChange={(e) => onBilingualChange?.("promptTextEnglish", e.target.value)}
                  placeholder="Enter English prompt text..."
                  rows={4}
                />
              </div>
            </div>

            {/* Arabic Fields */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Languages className="h-4 w-4" />
                Arabic Version
              </div>
              <div className="space-y-2" dir="rtl">
                <Label htmlFor="titleArabic" className="text-sm text-right">
                  العنوان (عربي)
                </Label>
                <Input
                  id="titleArabic"
                  value={titleArabic || ""}
                  onChange={(e) => onBilingualChange?.("titleArabic", e.target.value)}
                  placeholder="أدخل العنوان بالعربية..."
                  dir="rtl"
                />
              </div>
              <div className="space-y-2" dir="rtl">
                <Label htmlFor="promptTextArabic" className="text-sm text-right">
                  نص التوجيه (عربي)
                </Label>
                <Textarea
                  id="promptTextArabic"
                  value={promptTextArabic || ""}
                  onChange={(e) => onBilingualChange?.("promptTextArabic", e.target.value)}
                  placeholder="أدخل نص التوجيه بالعربية..."
                  rows={4}
                  dir="rtl"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <UseCaseField
        value={metadata.use_case || ""}
        onChange={(value) => onMetadataChange({ ...metadata, use_case: value })}
        promptText={promptText}
      />
    </>
  );
};
