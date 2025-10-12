import { useState } from 'react';
import { PromptWizard, PromptWizardDialog } from '@/components/prompts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Layers } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function WizardDemo() {
  const [showFullPageWizard, setShowFullPageWizard] = useState(false);
  const { toast } = useToast();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="default" className="text-xs">⭐ Phase 3.2</Badge>
          <h2 className="text-3xl font-bold">Prompt Creation Wizard</h2>
        </div>
        <p className="text-muted-foreground">
          Multi-step wizard for creating AI prompts - Choose between dialog or full-page mode
        </p>
      </div>

      {/* Demo Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Dialog Version */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Dialog Version</CardTitle>
            <CardDescription>
              Opens wizard in a modal dialog overlay
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PromptWizardDialog
              trigger={
                <Button size="lg" className="w-full">
                  <Plus className="h-5 w-5 mr-2" />
                  Create Prompt (Dialog)
                </Button>
              }
              onComplete={async (data) => {
                console.log('Prompt created:', data);
                await new Promise(resolve => setTimeout(resolve, 1000));
                toast({
                  title: "Prompt Created!",
                  description: "Check the console for the submitted data.",
                });
              }}
            />
          </CardContent>
        </Card>

        {/* Full Page Version */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Full Page Version</CardTitle>
            <CardDescription>
              Opens wizard in full page layout below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              size="lg" 
              variant="outline" 
              className="w-full"
              onClick={() => setShowFullPageWizard(!showFullPageWizard)}
            >
              <Layers className="h-5 w-5 mr-2" />
              {showFullPageWizard ? 'Hide' : 'Show'} Full Page Wizard
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Full Page Wizard */}
      {showFullPageWizard && (
        <Card className="border-2 border-primary/50">
          <CardHeader className="bg-primary/5">
            <CardTitle>Full Page Wizard</CardTitle>
            <CardDescription>
              Same wizard functionality as dialog, but in full page layout
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <PromptWizard
              onComplete={async (data) => {
                console.log('Prompt created:', data);
                await new Promise(resolve => setTimeout(resolve, 1000));
                toast({
                  title: "Prompt Created!",
                  description: "Check the console for the submitted data.",
                });
                setShowFullPageWizard(false);
              }}
              onCancel={() => setShowFullPageWizard(false)}
            />
          </CardContent>
        </Card>
      )}

      {/* Features Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">✨ Wizard Features</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs">
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>4-step guided flow</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Visual progress indicator</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Step validation & navigation</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>State persistence</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Mobile responsive</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-muted/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">⌨️ Keyboard Shortcuts</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-background rounded text-[10px]">Alt</kbd>
                <span>+</span>
                <kbd className="px-2 py-1 bg-background rounded text-[10px]">→</kbd>
                <span className="text-muted-foreground">Next Step</span>
              </li>
              <li className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-background rounded text-[10px]">Alt</kbd>
                <span>+</span>
                <kbd className="px-2 py-1 bg-background rounded text-[10px]">←</kbd>
                <span className="text-muted-foreground">Previous Step</span>
              </li>
              <li className="text-muted-foreground mt-2">
                💡 Click on step numbers to jump to completed steps
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-muted/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">📋 Test Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-1 text-xs list-decimal list-inside">
              <li>Select a platform (e.g., ChatGPT)</li>
              <li>Fill in base fields (title, text)</li>
              <li>Configure platform fields</li>
              <li>Review in preview</li>
              <li>Submit and see results</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
