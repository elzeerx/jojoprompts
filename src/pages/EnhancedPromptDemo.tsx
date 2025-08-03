import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Sparkles, Upload, FileText, Image, Video, Workflow } from 'lucide-react';
import { EnhancedPromptDialog } from '@/components/ui/EnhancedPromptDialog';
import { toast } from '@/hooks/use-toast';

export function EnhancedPromptDemo() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [savedPrompts, setSavedPrompts] = useState<any[]>([]);

  const handleSuccess = () => {
    toast({
      title: "Demo Success",
      description: "This is a demo - in a real app, the prompt would be saved to the database",
    });
  };

  const promptTypes = [
    {
      name: 'ChatGPT Text',
      description: 'Text-based prompts for language models',
      icon: FileText,
      color: '#10a37f'
    },
    {
      name: 'ChatGPT Image',
      description: 'Image generation prompts for DALL-E',
      icon: Image,
      color: '#ff6b35'
    },
    {
      name: 'Midjourney',
      description: 'Advanced image generation with parameters',
      icon: Image,
      color: '#7a9e9f'
    },
    {
      name: 'Video Generation',
      description: 'Video creation prompts',
      icon: Video,
      color: '#ff6b9d'
    },
    {
      name: 'Workflow',
      description: 'Automation workflow prompts',
      icon: Workflow,
      color: '#8b7fb8'
    }
  ];

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Enhanced Prompt Dialog Demo
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Test our new enhanced prompt creation system with model-specific fields, 
          validation, auto-save, and drag & drop uploads.
        </p>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              Model-Specific Fields
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Different fields and validation rules for each AI model type
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-green-600" />
              Drag & Drop Uploads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Easy file uploads with preview and validation
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-600" />
              Rich Text Editor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Format text with bold, italic, code, and links
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge className="h-5 w-5 text-orange-600" />
              Auto-Save
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Automatic draft saving and restoration
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge className="h-5 w-5 text-red-600" />
              Real-time Validation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Instant feedback and quality scoring
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge className="h-5 w-5 text-blue-600" />
              Quality Assessment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              AI-powered suggestions to improve prompts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Prompt Types */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Supported Prompt Types</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {promptTypes.map((type) => (
            <Card key={type.name} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: type.color }}
                  />
                  <div>
                    <h3 className="font-medium">{type.name}</h3>
                    <p className="text-sm text-gray-600">{type.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Demo Button */}
      <div className="text-center">
        <Button
          onClick={() => setDialogOpen(true)}
          size="lg"
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3"
        >
          <Plus className="mr-2 h-5 w-5" />
          Try Enhanced Prompt Dialog
        </Button>
        <p className="text-sm text-gray-500 mt-2">
          Click to open the enhanced prompt creation dialog
        </p>
      </div>

      {/* Enhanced Dialog */}
      <EnhancedPromptDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleSuccess}
      />

      {/* Instructions */}
      <div className="mt-12 p-6 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">How to Test:</h3>
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>Click the button above to open the enhanced dialog</li>
          <li>Select a prompt type (ChatGPT, Midjourney, etc.)</li>
          <li>Fill in the model-specific fields</li>
          <li>Try dragging files into the upload area</li>
          <li>Use the rich text editor for additional notes</li>
          <li>Watch the auto-save indicator and quality score</li>
          <li>Submit the form to see the success message</li>
        </ol>
      </div>
    </div>
  );
}

export default EnhancedPromptDemo; 