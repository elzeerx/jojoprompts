import { useState } from 'react';
import { Container } from '@/components/ui/container';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Blocks, 
  CheckCircle, 
  Wand2, 
  Grid3x3, 
  Workflow, 
  Eye, 
  FolderKanban,
  Sparkles 
} from 'lucide-react';
import { FieldComponentsDemo } from './FieldComponentsDemo';
import { ValidationDemo } from './ValidationDemo';
import { DynamicRenderingDemo } from './DynamicRenderingDemo';
import { PlatformSelectorDemo } from './PlatformSelectorDemo';
import { WizardDemo } from './WizardDemo';
import { PreviewDemo } from './PreviewDemo';
import { PromptManagementDemo } from './PromptManagementDemo';

export default function DemoHub() {
  const [activeTab, setActiveTab] = useState('management');

  return (
    <Container className="py-12">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Sparkles className="h-10 w-10 text-primary" />
            <h1 className="text-4xl font-bold">JojoPrompts Demo Hub</h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Interactive demonstrations of all platform features and components
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 w-full h-auto gap-2 bg-muted/50 p-2">
            <TabsTrigger value="management" className="flex-col gap-1 h-auto py-3">
              <FolderKanban className="h-5 w-5" />
              <span className="text-xs">Management</span>
            </TabsTrigger>
            <TabsTrigger value="wizard" className="flex-col gap-1 h-auto py-3">
              <Wand2 className="h-5 w-5" />
              <span className="text-xs">Wizard</span>
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex-col gap-1 h-auto py-3">
              <Eye className="h-5 w-5" />
              <span className="text-xs">Preview</span>
            </TabsTrigger>
            <TabsTrigger value="platform" className="flex-col gap-1 h-auto py-3">
              <Grid3x3 className="h-5 w-5" />
              <span className="text-xs">Platforms</span>
            </TabsTrigger>
            <TabsTrigger value="fields" className="flex-col gap-1 h-auto py-3">
              <Blocks className="h-5 w-5" />
              <span className="text-xs">Fields</span>
            </TabsTrigger>
            <TabsTrigger value="validation" className="flex-col gap-1 h-auto py-3">
              <CheckCircle className="h-5 w-5" />
              <span className="text-xs">Validation</span>
            </TabsTrigger>
            <TabsTrigger value="dynamic" className="flex-col gap-1 h-auto py-3">
              <Workflow className="h-5 w-5" />
              <span className="text-xs">Dynamic</span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-8">
            <TabsContent value="management" className="m-0">
              <PromptManagementDemo />
            </TabsContent>

            <TabsContent value="wizard" className="m-0">
              <WizardDemo />
            </TabsContent>

            <TabsContent value="preview" className="m-0">
              <PreviewDemo />
            </TabsContent>

            <TabsContent value="platform" className="m-0">
              <PlatformSelectorDemo />
            </TabsContent>

            <TabsContent value="fields" className="m-0">
              <FieldComponentsDemo />
            </TabsContent>

            <TabsContent value="validation" className="m-0">
              <ValidationDemo />
            </TabsContent>

            <TabsContent value="dynamic" className="m-0">
              <DynamicRenderingDemo />
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer Info */}
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-sm">🧪 Demo Environment</CardTitle>
            <CardDescription className="text-xs">
              This hub contains interactive demos for all phases of development. 
              The Management tab shows the complete CRUD functionality for prompts.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </Container>
  );
}
