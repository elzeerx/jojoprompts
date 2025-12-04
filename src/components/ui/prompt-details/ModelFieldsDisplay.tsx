import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { getPromptTypeById, type ModelPromptType } from "@/utils/promptTypes";
import { cn } from "@/lib/utils";

interface ModelFieldsDisplayProps {
  modelType: string;
  modelFields: Record<string, any>;
  isRTL?: boolean;
  isLocked?: boolean;
}

export function ModelFieldsDisplay({ 
  modelType, 
  modelFields, 
  isRTL = false,
  isLocked = false 
}: ModelFieldsDisplayProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  const promptType = getPromptTypeById(modelType);
  
  if (!promptType || !modelFields || Object.keys(modelFields).length === 0) {
    return null;
  }

  const handleCopyField = async (fieldId: string, value: any) => {
    try {
      const textValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
      await navigator.clipboard.writeText(textValue);
      setCopiedField(fieldId);
      toast({
        title: "Copied",
        description: "Field value copied to clipboard"
      });
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive"
      });
    }
  };

  const handleCopyAllFields = async () => {
    try {
      const allFields = promptType.fields
        .filter(field => modelFields[field.id] !== undefined && modelFields[field.id] !== '')
        .map(field => {
          const value = modelFields[field.id];
          const displayValue = getDisplayValue(field, value);
          return `${field.name}: ${displayValue}`;
        })
        .join('\n');
      
      await navigator.clipboard.writeText(allFields);
      toast({
        title: "Copied All",
        description: "All parameters copied to clipboard"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive"
      });
    }
  };

  // Get display value for a field (convert value to label for selects)
  const getDisplayValue = (field: any, value: any): string => {
    if (field.type === 'select' && field.options) {
      const option = field.options.find((opt: any) => opt.value === value);
      return option ? option.label : value;
    }
    if (field.type === 'multiselect' && Array.isArray(value)) {
      return value.map(v => {
        const option = field.options?.find((opt: any) => opt.value === v);
        return option ? option.label : v;
      }).join(', ');
    }
    if (field.type === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  };

  // Filter out empty fields and promptText (shown separately)
  const displayFields = promptType.fields.filter(field => 
    field.id !== 'promptText' && 
    modelFields[field.id] !== undefined && 
    modelFields[field.id] !== '' &&
    modelFields[field.id] !== null
  );

  if (displayFields.length === 0) {
    return null;
  }

  return (
    <div className={cn(
      "space-y-4",
      isLocked && 'blur-md select-none pointer-events-none'
    )}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          {isRTL ? 'معلمات النموذج' : 'Model Parameters'}
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyAllFields}
          className="text-xs"
        >
          <Copy className="h-3 w-3 mr-1" />
          {isRTL ? 'نسخ الكل' : 'Copy All'}
        </Button>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {displayFields.map(field => {
          const value = modelFields[field.id];
          const displayValue = getDisplayValue(field, value);
          const isCopied = copiedField === field.id;
          
          return (
            <div 
              key={field.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 mb-0.5">{field.name}</p>
                <p className="text-sm font-medium text-gray-900 truncate">
                  {displayValue}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopyField(field.id, value)}
                className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
              >
                {isCopied ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-gray-500" />
                )}
              </Button>
            </div>
          );
        })}
      </div>

      {/* Platform badge */}
      <div className="flex items-center gap-2 pt-2">
        <Badge 
          variant="outline" 
          className="text-xs"
          style={{ borderColor: promptType.color, color: promptType.color }}
        >
          {promptType.name}
        </Badge>
      </div>
    </div>
  );
}
