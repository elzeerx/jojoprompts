import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Globe, 
  Code, 
  Image, 
  FileSearch, 
  Copy, 
  ChevronDown, 
  ChevronUp,
  MessageSquare,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { GPTConfiguration } from './GPTsBuilderWizard';
import { GPTExportDialog } from './GPTExportDialog';

interface GPTConfigDisplayProps {
  config: GPTConfiguration;
  className?: string;
}

export function GPTConfigDisplay({ config, className }: GPTConfigDisplayProps) {
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  const capabilities = [
    { key: 'webBrowsing', label: 'Web Browsing', icon: Globe, color: 'text-blue-500' },
    { key: 'codeInterpreter', label: 'Code Interpreter', icon: Code, color: 'text-green-500' },
    { key: 'dallE', label: 'DALL·E', icon: Image, color: 'text-purple-500' },
    { key: 'fileSearch', label: 'File Search', icon: FileSearch, color: 'text-orange-500' },
  ] as const;

  const enabledCapabilities = capabilities.filter(
    cap => config.capabilities[cap.key]
  );

  return (
    <>
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-warm-gold" />
              GPT Configuration
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowExportDialog(true)}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Capabilities */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Capabilities</h4>
            {enabledCapabilities.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {enabledCapabilities.map(cap => (
                  <Badge key={cap.key} variant="secondary" className="flex items-center gap-1">
                    <cap.icon className={`h-3 w-3 ${cap.color}`} />
                    {cap.label}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No capabilities enabled</p>
            )}
          </div>

          {/* Conversation Starters */}
          {config.conversationStarters.filter(s => s.trim()).length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Conversation Starters
              </h4>
              <div className="space-y-2">
                {config.conversationStarters.filter(s => s.trim()).map((starter, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border/30"
                  >
                    <span className="text-sm">{starter}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(starter, 'Conversation starter')}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* System Instructions */}
          <Collapsible open={isInstructionsOpen} onOpenChange={setIsInstructionsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-2 h-auto">
                <span className="text-sm font-medium text-muted-foreground">
                  System Instructions
                </span>
                {isInstructionsOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2">
              <div className="p-3 rounded-lg bg-muted/50 border border-border/30">
                <pre className="text-sm whitespace-pre-wrap font-mono">
                  {config.systemPrompt.length > 500 
                    ? `${config.systemPrompt.substring(0, 500)}...` 
                    : config.systemPrompt}
                </pre>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => copyToClipboard(config.systemPrompt, 'System instructions')}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Full Instructions
              </Button>
            </CollapsibleContent>
          </Collapsible>

          {/* Actions Preview */}
          {config.customActions && (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-2 h-auto">
                  <span className="text-sm font-medium text-muted-foreground">
                    Custom Actions
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-3 rounded-lg bg-muted/50 border border-border/30">
                  <pre className="text-xs whitespace-pre-wrap font-mono overflow-x-auto">
                    {config.customActions}
                  </pre>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Import Instructions */}
          <div className="p-3 rounded-lg bg-warm-gold/10 border border-warm-gold/20">
            <h4 className="text-sm font-medium text-warm-gold mb-2">How to use</h4>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Go to chat.openai.com → Explore GPTs → Create</li>
              <li>Paste the system instructions</li>
              <li>Enable capabilities and add starters</li>
              <li>Save your GPT!</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <GPTExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        config={config}
      />
    </>
  );
}
