import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Image, Video, Workflow, Bot, MessageSquare } from "lucide-react";
import { ModelPromptType } from "@/utils/promptTypes";

interface CategorySelectorProps {
  templates: ModelPromptType[];
  selectedTemplate: ModelPromptType | null;
  onTemplateSelect: (template: ModelPromptType) => void;
}

const getCategoryIcon = (category: string) => {
  switch (category.toLowerCase()) {
    case 'chatgpt':
      return <MessageSquare className="h-6 w-6" />;
    case 'claude':
      return <Bot className="h-6 w-6" />;
    case 'midjourney':
      return <Image className="h-6 w-6" />;
    case 'video':
      return <Video className="h-6 w-6" />;
    case 'workflow':
      return <Workflow className="h-6 w-6" />;
    default:
      return <Sparkles className="h-6 w-6" />;
  }
};

const getCategoryColor = (category: string) => {
  switch (category.toLowerCase()) {
    case 'chatgpt':
      return 'hsl(var(--warm-gold))';
    case 'claude':
      return 'hsl(var(--muted-teal))';
    case 'midjourney':
      return 'hsl(var(--muted-teal))';
    case 'video':
      return '#ff6b9d';
    case 'workflow':
      return '#8b7fb8';
    default:
      return 'hsl(var(--warm-gold))';
  }
};

export function CategorySelector({ templates, selectedTemplate, onTemplateSelect }: CategorySelectorProps) {
  // Group templates by category
  const groupedTemplates = templates.reduce((acc, template) => {
    const category = template.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(template);
    return acc;
  }, {} as Record<string, ModelPromptType[]>);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Choose AI Model Category
        </h3>
        <p className="text-sm text-muted-foreground">
          Select the AI model you want to create a prompt for
        </p>
      </div>

      <div className="grid gap-4">
        {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
          <div key={category} className="space-y-3">
            <div className="flex items-center gap-2">
              <div 
                className="p-2 rounded-lg text-white flex items-center justify-center"
                style={{ backgroundColor: getCategoryColor(category) }}
              >
                {getCategoryIcon(category)}
              </div>
              <h4 className="font-medium text-foreground">{category}</h4>
            </div>
            
            <div className="grid gap-2 ml-12">
              {categoryTemplates.map((template) => (
                <Card 
                  key={template.id}
                  className={`cursor-pointer transition-all hover:shadow-md border-2 ${
                    selectedTemplate?.id === template.id 
                      ? 'border-[var(--warm-gold)] bg-[var(--warm-gold)]/5' 
                      : 'border-border hover:border-[var(--warm-gold)]/50'
                  }`}
                  onClick={() => onTemplateSelect(template)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h5 className="font-medium text-foreground">{template.name}</h5>
                      {selectedTemplate?.id === template.id && (
                        <Badge 
                          className="text-xs text-white"
                          style={{ backgroundColor: getCategoryColor(category) }}
                        >
                          Selected
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {template.description}
                    </p>
                    
                    {template.examples && template.examples.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Example:</p>
                        <p className="text-xs text-muted-foreground italic">
                          {template.examples[0]}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}