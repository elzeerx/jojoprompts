import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Download, FileJson, MessageSquare, FileText, ExternalLink } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { GPTConfiguration } from './GPTsBuilderWizard';

interface GPTExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: GPTConfiguration;
}

export function GPTExportDialog({ open, onOpenChange, config }: GPTExportDialogProps) {
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  const exportAsJson = () => {
    const json = JSON.stringify(config, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.name.replace(/\s+/g, '-').toLowerCase()}-gpt-config.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Exported!",
      description: "GPT configuration downloaded as JSON",
    });
  };

  const formatConversationStarters = () => {
    return config.conversationStarters
      .filter(s => s.trim())
      .map((s, i) => `${i + 1}. ${s}`)
      .join('\n');
  };

  const formatCapabilities = () => {
    const caps = [];
    if (config.capabilities.webBrowsing) caps.push('✓ Web Browsing');
    if (config.capabilities.codeInterpreter) caps.push('✓ Code Interpreter');
    if (config.capabilities.dallE) caps.push('✓ DALL·E Image Generation');
    if (config.capabilities.fileSearch) caps.push('✓ File Search');
    return caps.length > 0 ? caps.join('\n') : 'No capabilities enabled';
  };

  const fullExport = `# ${config.name}

${config.description}

## System Instructions
${config.systemPrompt}

## Capabilities
${formatCapabilities()}

## Conversation Starters
${formatConversationStarters()}

${config.customActions ? `## Custom Actions\n\`\`\`json\n${config.customActions}\n\`\`\`` : ''}
`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export GPT Configuration</DialogTitle>
          <DialogDescription>
            Copy or download your GPT configuration to use in ChatGPT
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="instructions" className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="instructions">
              <FileText className="h-4 w-4 mr-2" />
              Instructions
            </TabsTrigger>
            <TabsTrigger value="starters">
              <MessageSquare className="h-4 w-4 mr-2" />
              Starters
            </TabsTrigger>
            <TabsTrigger value="full">
              <Copy className="h-4 w-4 mr-2" />
              Full
            </TabsTrigger>
            <TabsTrigger value="json">
              <FileJson className="h-4 w-4 mr-2" />
              JSON
            </TabsTrigger>
          </TabsList>

          <TabsContent value="instructions" className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Copy this to the "Instructions" field in GPT Builder
              </p>
              <Textarea
                value={config.systemPrompt}
                readOnly
                rows={12}
                className="font-mono text-sm"
              />
            </div>
            <Button 
              className="w-full" 
              onClick={() => copyToClipboard(config.systemPrompt, 'System instructions')}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Instructions
            </Button>
          </TabsContent>

          <TabsContent value="starters" className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Conversation starters for your GPT
              </p>
              <div className="space-y-2">
                {config.conversationStarters.filter(s => s.trim()).map((starter, index) => (
                  <div 
                    key={index} 
                    className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card"
                  >
                    <span className="text-sm">{starter}</span>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => copyToClipboard(starter, 'Starter')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <Button 
              className="w-full" 
              onClick={() => copyToClipboard(formatConversationStarters(), 'Conversation starters')}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy All Starters
            </Button>
          </TabsContent>

          <TabsContent value="full" className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Complete configuration in markdown format
              </p>
              <Textarea
                value={fullExport}
                readOnly
                rows={12}
                className="font-mono text-sm"
              />
            </div>
            <Button 
              className="w-full" 
              onClick={() => copyToClipboard(fullExport, 'Full configuration')}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Full Configuration
            </Button>
          </TabsContent>

          <TabsContent value="json" className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                JSON format for backup or programmatic use
              </p>
              <Textarea
                value={JSON.stringify(config, null, 2)}
                readOnly
                rows={12}
                className="font-mono text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                className="flex-1" 
                variant="outline"
                onClick={() => copyToClipboard(JSON.stringify(config, null, 2), 'JSON')}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy JSON
              </Button>
              <Button 
                className="flex-1"
                onClick={exportAsJson}
              >
                <Download className="h-4 w-4 mr-2" />
                Download JSON
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border/50">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            Import to ChatGPT
          </h4>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Go to <a href="https://chat.openai.com" target="_blank" rel="noopener noreferrer" className="text-warm-gold hover:underline">chat.openai.com</a></li>
            <li>Click "Explore GPTs" → "Create"</li>
            <li>In the "Configure" tab, paste your instructions</li>
            <li>Enable the required capabilities</li>
            <li>Add conversation starters and save!</li>
          </ol>
        </div>
      </DialogContent>
    </Dialog>
  );
}
