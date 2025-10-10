import React, { useMemo } from 'react';
import { Platform } from '@/types/platform';
import { PromptFormData } from '@/types/prompt-form';
import { PromptPreviewCard } from './PromptPreviewCard';
import { PromptSummary } from './PromptSummary';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { formatPromptForPlatform } from '@/lib/formatters/promptFormatter';

export interface PromptPreviewProps {
  data: PromptFormData;
  platform: Platform;
  categoryName?: string;
  onEdit?: (step: number) => void;
  className?: string;
}

export function PromptPreview({
  data,
  platform,
  categoryName,
  onEdit,
  className
}: PromptPreviewProps) {
  
  const formattedPrompt = useMemo(() => {
    return formatPromptForPlatform(data, platform);
  }, [data, platform]);

  return (
    <div className={className}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Preview Area (2/3 width on large screens) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info Alert */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Review your prompt below. You can edit any section by clicking the Edit buttons.
            </AlertDescription>
          </Alert>

          {/* Tabbed Preview */}
          <Tabs defaultValue="formatted" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="formatted">Formatted</TabsTrigger>
              <TabsTrigger value="raw">Raw Text</TabsTrigger>
              <TabsTrigger value="config">Configuration</TabsTrigger>
            </TabsList>

            {/* Formatted Prompt */}
            <TabsContent value="formatted" className="mt-4">
              <PromptPreviewCard
                title="Generated Prompt"
                content={formattedPrompt.fullPrompt}
                showCopy={true}
                showLineNumbers={false}
                maxHeight="600px"
              />
            </TabsContent>

            {/* Raw Text */}
            <TabsContent value="raw" className="mt-4">
              <PromptPreviewCard
                title="Raw Prompt Text"
                content={data.prompt_text}
                showCopy={true}
                showLineNumbers={true}
                maxHeight="600px"
              />
            </TabsContent>

            {/* Platform Configuration */}
            <TabsContent value="config" className="mt-4">
              <PromptPreviewCard
                title={`${platform.name} Settings`}
                content={formattedPrompt.platformSpecific}
                language="json"
                showCopy={true}
                showLineNumbers={true}
                maxHeight="600px"
              />
            </TabsContent>
          </Tabs>

          {/* Bilingual Support Preview (if exists) */}
          {data.title_ar && (
            <PromptPreviewCard
              title="Arabic Title"
              content={data.title_ar}
              showCopy={true}
            />
          )}
          
          {data.prompt_text_ar && (
            <PromptPreviewCard
              title="Arabic Prompt Text"
              content={data.prompt_text_ar}
              showCopy={true}
              showLineNumbers={true}
              maxHeight="400px"
            />
          )}
        </div>

        {/* Summary Sidebar (1/3 width on large screens) */}
        <div className="lg:col-span-1">
          <PromptSummary
            data={data}
            platform={platform}
            categoryName={categoryName}
            onEdit={onEdit}
          />
        </div>
      </div>
    </div>
  );
}
