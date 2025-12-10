import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  Sparkles, 
  Globe, 
  Code, 
  Image, 
  FileSearch,
  Plus,
  X,
  Copy,
  Download
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export interface GPTConfiguration {
  name: string;
  description: string;
  systemPrompt: string;
  conversationStarters: string[];
  capabilities: {
    webBrowsing: boolean;
    codeInterpreter: boolean;
    dallE: boolean;
    fileSearch: boolean;
  };
  customActions: string;
}

interface GPTsBuilderWizardProps {
  initialConfig?: Partial<GPTConfiguration>;
  onComplete?: (config: GPTConfiguration) => void;
  onCancel?: () => void;
}

const WIZARD_STEPS = [
  { id: 'basic', title: 'Basic Info', description: 'Name and description' },
  { id: 'instructions', title: 'Instructions', description: 'System prompt' },
  { id: 'capabilities', title: 'Capabilities', description: 'Enable features' },
  { id: 'starters', title: 'Starters', description: 'Conversation starters' },
  { id: 'actions', title: 'Actions', description: 'Custom actions (optional)' },
  { id: 'review', title: 'Review', description: 'Export configuration' },
];

const defaultConfig: GPTConfiguration = {
  name: '',
  description: '',
  systemPrompt: '',
  conversationStarters: [''],
  capabilities: {
    webBrowsing: false,
    codeInterpreter: false,
    dallE: false,
    fileSearch: false,
  },
  customActions: '',
};

export function GPTsBuilderWizard({ initialConfig, onComplete, onCancel }: GPTsBuilderWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [config, setConfig] = useState<GPTConfiguration>({
    ...defaultConfig,
    ...initialConfig,
  });

  const progress = ((currentStep + 1) / WIZARD_STEPS.length) * 100;

  const updateConfig = <K extends keyof GPTConfiguration>(key: K, value: GPTConfiguration[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const addConversationStarter = () => {
    setConfig(prev => ({
      ...prev,
      conversationStarters: [...prev.conversationStarters, ''],
    }));
  };

  const updateConversationStarter = (index: number, value: string) => {
    setConfig(prev => ({
      ...prev,
      conversationStarters: prev.conversationStarters.map((s, i) => i === index ? value : s),
    }));
  };

  const removeConversationStarter = (index: number) => {
    setConfig(prev => ({
      ...prev,
      conversationStarters: prev.conversationStarters.filter((_, i) => i !== index),
    }));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: return config.name.trim().length > 0;
      case 1: return config.systemPrompt.trim().length > 0;
      default: return true;
    }
  };

  const handleNext = () => {
    if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    onComplete?.(config);
    toast({
      title: "GPT Configuration Created",
      description: "Your GPT configuration is ready to use!",
    });
  };

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

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="gpt-name">GPT Name *</Label>
              <Input
                id="gpt-name"
                placeholder="e.g., Writing Assistant, Code Reviewer"
                value={config.name}
                onChange={(e) => updateConfig('name', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gpt-description">Description</Label>
              <Textarea
                id="gpt-description"
                placeholder="Describe what your GPT does..."
                value={config.description}
                onChange={(e) => updateConfig('description', e.target.value)}
                rows={4}
              />
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="system-prompt">System Instructions *</Label>
              <p className="text-sm text-muted-foreground">
                Define how your GPT should behave, its personality, and what it should do.
              </p>
              <Textarea
                id="system-prompt"
                placeholder="You are a helpful assistant that..."
                value={config.systemPrompt}
                onChange={(e) => updateConfig('systemPrompt', e.target.value)}
                rows={12}
                className="font-mono text-sm"
              />
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Sparkles className="h-4 w-4 text-warm-gold" />
              <span className="text-sm text-muted-foreground">
                Tip: Be specific about tone, format, and any constraints.
              </span>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Enable the capabilities your GPT needs to function effectively.
            </p>
            
            <div className="grid gap-4">
              <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-card">
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium">Web Browsing</p>
                    <p className="text-sm text-muted-foreground">Search and browse the internet</p>
                  </div>
                </div>
                <Switch
                  checked={config.capabilities.webBrowsing}
                  onCheckedChange={(checked) => 
                    updateConfig('capabilities', { ...config.capabilities, webBrowsing: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-card">
                <div className="flex items-center gap-3">
                  <Code className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">Code Interpreter</p>
                    <p className="text-sm text-muted-foreground">Run code and analyze data</p>
                  </div>
                </div>
                <Switch
                  checked={config.capabilities.codeInterpreter}
                  onCheckedChange={(checked) => 
                    updateConfig('capabilities', { ...config.capabilities, codeInterpreter: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-card">
                <div className="flex items-center gap-3">
                  <Image className="h-5 w-5 text-purple-500" />
                  <div>
                    <p className="font-medium">DALL·E Image Generation</p>
                    <p className="text-sm text-muted-foreground">Generate images from text</p>
                  </div>
                </div>
                <Switch
                  checked={config.capabilities.dallE}
                  onCheckedChange={(checked) => 
                    updateConfig('capabilities', { ...config.capabilities, dallE: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-card">
                <div className="flex items-center gap-3">
                  <FileSearch className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="font-medium">File Search</p>
                    <p className="text-sm text-muted-foreground">Search through uploaded files</p>
                  </div>
                </div>
                <Switch
                  checked={config.capabilities.fileSearch}
                  onCheckedChange={(checked) => 
                    updateConfig('capabilities', { ...config.capabilities, fileSearch: checked })
                  }
                />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Conversation Starters</Label>
              <p className="text-sm text-muted-foreground">
                Suggest prompts users can click to start a conversation.
              </p>
            </div>

            <div className="space-y-3">
              {config.conversationStarters.map((starter, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder={`e.g., "Help me write a blog post about..."`}
                    value={starter}
                    onChange={(e) => updateConversationStarter(index, e.target.value)}
                  />
                  {config.conversationStarters.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeConversationStarter(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {config.conversationStarters.length < 4 && (
              <Button variant="outline" size="sm" onClick={addConversationStarter}>
                <Plus className="h-4 w-4 mr-2" />
                Add Starter
              </Button>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="custom-actions">Custom Actions (Optional)</Label>
              <p className="text-sm text-muted-foreground">
                Define API schemas in OpenAPI format for custom functionality.
              </p>
            </div>
            <Textarea
              id="custom-actions"
              placeholder={`{
  "openapi": "3.0.0",
  "info": { "title": "My API", "version": "1.0.0" },
  "paths": { ... }
}`}
              value={config.customActions}
              onChange={(e) => updateConfig('customActions', e.target.value)}
              rows={12}
              className="font-mono text-sm"
            />
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="p-4 rounded-lg border border-border/50 bg-card">
              <h3 className="font-semibold mb-2">{config.name || 'Untitled GPT'}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {config.description || 'No description provided'}
              </p>

              <div className="flex flex-wrap gap-2 mb-4">
                {config.capabilities.webBrowsing && (
                  <Badge variant="secondary"><Globe className="h-3 w-3 mr-1" /> Web</Badge>
                )}
                {config.capabilities.codeInterpreter && (
                  <Badge variant="secondary"><Code className="h-3 w-3 mr-1" /> Code</Badge>
                )}
                {config.capabilities.dallE && (
                  <Badge variant="secondary"><Image className="h-3 w-3 mr-1" /> DALL·E</Badge>
                )}
                {config.capabilities.fileSearch && (
                  <Badge variant="secondary"><FileSearch className="h-3 w-3 mr-1" /> Files</Badge>
                )}
              </div>

              {config.conversationStarters.filter(s => s.trim()).length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">CONVERSATION STARTERS</p>
                  <div className="flex flex-wrap gap-2">
                    {config.conversationStarters.filter(s => s.trim()).map((starter, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {starter}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => copyToClipboard(config.systemPrompt, 'System prompt')}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Instructions
              </Button>
              <Button
                variant="outline"
                onClick={exportAsJson}
              >
                <Download className="h-4 w-4 mr-2" />
                Export JSON
              </Button>
            </div>

            <div className="p-4 rounded-lg bg-warm-gold/10 border border-warm-gold/20">
              <h4 className="font-medium text-warm-gold mb-2">How to use in ChatGPT</h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Go to chat.openai.com and click "Explore GPTs"</li>
                <li>Click "Create" in the top right</li>
                <li>Paste the system instructions in the "Instructions" field</li>
                <li>Configure capabilities and add conversation starters</li>
                <li>Save your GPT!</li>
              </ol>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between mb-4">
          <div>
            <CardTitle className="text-xl">Create GPT Configuration</CardTitle>
            <CardDescription>
              Step {currentStep + 1} of {WIZARD_STEPS.length}: {WIZARD_STEPS[currentStep].title}
            </CardDescription>
          </div>
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Progress value={progress} className="h-2" />
        
        <div className="flex justify-between mt-4 overflow-x-auto">
          {WIZARD_STEPS.map((step, index) => (
            <button
              key={step.id}
              onClick={() => index <= currentStep && setCurrentStep(index)}
              className={`flex flex-col items-center min-w-[60px] transition-colors ${
                index <= currentStep ? 'text-foreground' : 'text-muted-foreground'
              } ${index < currentStep ? 'cursor-pointer' : ''}`}
              disabled={index > currentStep}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium mb-1 ${
                index < currentStep 
                  ? 'bg-warm-gold text-white' 
                  : index === currentStep 
                    ? 'bg-warm-gold/20 text-warm-gold border-2 border-warm-gold' 
                    : 'bg-muted text-muted-foreground'
              }`}>
                {index < currentStep ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span className="text-xs hidden sm:block">{step.title}</span>
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        <div className="min-h-[300px]">
          {renderStep()}
        </div>

        <div className="flex justify-between mt-6 pt-4 border-t border-border/50">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>

          {currentStep < WIZARD_STEPS.length - 1 ? (
            <Button onClick={handleNext} disabled={!canProceed()}>
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleComplete} className="bg-warm-gold hover:bg-warm-gold/90">
              <Check className="h-4 w-4 mr-2" />
              Complete
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
