import React from 'react';
import { cn } from '@/lib/utils';
import { Globe, Code, Image, FileSearch, Copy, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface ConfigurationSectionProps {
  modelFields?: Record<string, any>;
  modelType?: string;
  category?: string;
  isRTL?: boolean;
}

// Format field key for display
function formatFieldKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Format field value for display
function formatFieldValue(value: any): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

// Capability configuration with icons and labels
const CAPABILITY_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  webBrowsing: { icon: Globe, label: 'Web Browsing', color: 'bg-blue-100 text-blue-700' },
  web_browsing: { icon: Globe, label: 'Web Browsing', color: 'bg-blue-100 text-blue-700' },
  codeInterpreter: { icon: Code, label: 'Code Interpreter', color: 'bg-purple-100 text-purple-700' },
  code_interpreter: { icon: Code, label: 'Code Interpreter', color: 'bg-purple-100 text-purple-700' },
  dallE: { icon: Image, label: 'DALL·E', color: 'bg-green-100 text-green-700' },
  dall_e: { icon: Image, label: 'DALL·E', color: 'bg-green-100 text-green-700' },
  fileSearch: { icon: FileSearch, label: 'File Search', color: 'bg-amber-100 text-amber-700' },
  file_search: { icon: FileSearch, label: 'File Search', color: 'bg-amber-100 text-amber-700' },
};

// Check if this is a GPT configuration
function isGPTConfig(modelFields: Record<string, any>): boolean {
  return !!(
    modelFields.conversationStarters || 
    modelFields.conversation_starters || 
    modelFields.capabilities ||
    modelFields.systemPrompt ||
    modelFields.system_prompt
  );
}

// Get conversation starters from various formats
function getConversationStarters(modelFields: Record<string, any>): string[] {
  const starters = modelFields.conversationStarters || modelFields.conversation_starters;
  if (!starters) return [];
  
  if (Array.isArray(starters)) {
    return starters.filter(s => s && typeof s === 'string' && s.trim());
  }
  if (typeof starters === 'string') {
    return starters.split('\n').filter(s => s.trim());
  }
  return [];
}

// Get enabled capabilities
function getEnabledCapabilities(modelFields: Record<string, any>): string[] {
  const capabilities = modelFields.capabilities;
  if (!capabilities) return [];
  
  if (Array.isArray(capabilities)) {
    return capabilities.filter(c => c && typeof c === 'string');
  }
  if (typeof capabilities === 'object') {
    return Object.entries(capabilities)
      .filter(([_, enabled]) => enabled === true)
      .map(([key]) => key);
  }
  return [];
}

// Conversation Starters component
function ConversationStartersSection({ starters, isRTL }: { starters: string[]; isRTL: boolean }) {
  const { toast } = useToast();
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);

  const copyStarter = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast({ description: "Copied to clipboard" });
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (starters.length === 0) return null;

  return (
    <div className="space-y-2">
      <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Conversation Starters
      </h5>
      <div className="space-y-2">
        {starters.map((starter, index) => (
          <div
            key={index}
            className={cn(
              "flex items-start gap-2 p-3 rounded-lg bg-gray-50 border border-gray-100 group",
              isRTL && "flex-row-reverse text-right"
            )}
          >
            <span className="flex-1 text-sm text-gray-700">{starter}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => copyStarter(starter, index)}
            >
              {copiedIndex === index ? (
                <Check className="h-3 w-3 text-green-600" />
              ) : (
                <Copy className="h-3 w-3 text-gray-400" />
              )}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Capabilities component
function CapabilitiesSection({ capabilities, isRTL }: { capabilities: string[]; isRTL: boolean }) {
  if (capabilities.length === 0) return null;

  return (
    <div className="space-y-2">
      <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Capabilities
      </h5>
      <div className={cn("flex flex-wrap gap-2", isRTL && "flex-row-reverse")}>
        {capabilities.map((cap) => {
          const config = CAPABILITY_CONFIG[cap];
          if (!config) return null;
          
          const Icon = config.icon;
          return (
            <Badge
              key={cap}
              variant="secondary"
              className={cn("flex items-center gap-1.5 px-2.5 py-1", config.color)}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">{config.label}</span>
            </Badge>
          );
        })}
      </div>
    </div>
  );
}

export function ConfigurationSection({
  modelFields,
  modelType,
  category,
  isRTL = false
}: ConfigurationSectionProps) {
  // Check if this is a GPT configuration
  const isGPT = modelFields && isGPTConfig(modelFields);
  
  if (isGPT) {
    const starters = getConversationStarters(modelFields);
    const capabilities = getEnabledCapabilities(modelFields);
    
    // Filter out GPT-specific fields for generic display
    const otherFields = Object.entries(modelFields)
      .filter(([key, value]) => {
        const gptKeys = ['conversationStarters', 'conversation_starters', 'capabilities', 'systemPrompt', 'system_prompt', 'name', 'description'];
        return !gptKeys.includes(key) && value !== null && value !== undefined && value !== '';
      })
      .slice(0, 4);

    return (
      <div className={cn("border-t border-gray-100 pt-4 sm:pt-6 space-y-4", isRTL && "text-right")}>
        <h4 className="text-sm font-semibold text-gray-900">GPT Configuration</h4>
        
        <CapabilitiesSection capabilities={capabilities} isRTL={isRTL} />
        <ConversationStartersSection starters={starters} isRTL={isRTL} />
        
        {otherFields.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {otherFields.map(([key, value]) => (
              <div 
                key={key} 
                className="p-3 rounded-lg border border-gray-100 bg-gray-50/50"
              >
                <span className="block text-xs text-gray-400 mb-1">
                  {formatFieldKey(key)}
                </span>
                <span className="text-sm font-medium text-gray-700 line-clamp-2">
                  {formatFieldValue(value)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Generic field display for non-GPT prompts
  const displayFields = Object.entries(modelFields || {})
    .filter(([_, value]) => value !== null && value !== undefined && value !== '')
    .slice(0, 6);

  if (displayFields.length === 0) {
    const basicConfig = [
      { key: 'Model', value: modelType || category || 'Standard' },
    ];

    return (
      <div className={cn("border-t border-gray-100 pt-4 sm:pt-6", isRTL && "text-right")}>
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Configuration</h4>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {basicConfig.map(({ key, value }) => (
            <div 
              key={key} 
              className="p-3 rounded-lg border border-gray-100 bg-gray-50/50"
            >
              <span className="block text-xs text-gray-400 mb-1">{key}</span>
              <span className="text-sm font-medium text-gray-700">{value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("border-t border-gray-100 pt-4 sm:pt-6", isRTL && "text-right")}>
      <h4 className="text-sm font-semibold text-gray-900 mb-3">Configuration</h4>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {displayFields.map(([key, value]) => (
          <div 
            key={key} 
            className="p-3 rounded-lg border border-gray-100 bg-gray-50/50"
          >
            <span className="block text-xs text-gray-400 mb-1">
              {formatFieldKey(key)}
            </span>
            <span className="text-sm font-medium text-gray-700 line-clamp-2">
              {formatFieldValue(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
