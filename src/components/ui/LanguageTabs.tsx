import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Globe, Languages } from "lucide-react";
import { cn } from "@/lib/utils";

export type Language = 'english' | 'arabic';

interface LanguageTabsProps {
  hasTranslations: boolean;
  selectedLanguage: Language;
  onLanguageChange: (language: Language) => void;
  children: (language: Language) => React.ReactNode;
}

export function LanguageTabs({ 
  hasTranslations, 
  selectedLanguage, 
  onLanguageChange, 
  children 
}: LanguageTabsProps) {
  if (!hasTranslations) {
    return <>{children(selectedLanguage)}</>;
  }

  return (
    <Tabs value={selectedLanguage} onValueChange={(value) => onLanguageChange(value as Language)}>
      <TabsList className="grid w-full grid-cols-2 mb-4">
        <TabsTrigger 
          value="english" 
          className="flex items-center gap-2 data-[state=active]:bg-[#c49d68] data-[state=active]:text-white"
        >
          <Globe className="h-4 w-4" />
          English
        </TabsTrigger>
        <TabsTrigger 
          value="arabic" 
          className="flex items-center gap-2 data-[state=active]:bg-[#c49d68] data-[state=active]:text-white"
        >
          <Languages className="h-4 w-4" />
          العربية
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="english" className="mt-0">
        {children('english')}
      </TabsContent>
      
      <TabsContent value="arabic" className="mt-0 text-right" dir="rtl">
        {children('arabic')}
      </TabsContent>
    </Tabs>
  );
}