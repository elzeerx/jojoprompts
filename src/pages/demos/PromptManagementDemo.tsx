import { useState } from 'react';
import {
  PromptWizardDialog,
  EditPromptButton,
} from '@/components/prompts';
import { usePromptList } from '@/hooks/usePromptList';
import { PromptFormData } from '@/types/prompt-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function PromptManagementDemo() {
  const { prompts, loading, refetch } = usePromptList(10);

  const handlePromptComplete = async (data: PromptFormData) => {
    console.log('Prompt completed:', data);
    refetch();
  };

  const handleEditSuccess = () => {
    refetch();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Prompt Management System</h2>
          <p className="text-muted-foreground">
            Complete CRUD operations for prompts (Phase 3.5)
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={refetch} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          
          <PromptWizardDialog
            trigger={
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create New Prompt
              </Button>
            }
            onComplete={handlePromptComplete}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Prompts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{prompts.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Create Mode
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">Add new prompts to your collection</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Edit Mode
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">Update existing prompts easily</div>
          </CardContent>
        </Card>
      </div>

      {/* Prompts List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Prompts</CardTitle>
          <CardDescription>
            Click the Edit button to update any prompt
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : prompts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No prompts yet. Create your first one!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {prompts.map((prompt) => (
                <Card key={prompt.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{prompt.title}</CardTitle>
                          {prompt.platform && (
                            <Badge variant="secondary" className="text-xs">
                              {prompt.platform.name}
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="line-clamp-2">
                          {prompt.prompt_text}
                        </CardDescription>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>
                            Created {formatDistanceToNow(new Date(prompt.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>

                      <EditPromptButton
                        promptId={prompt.id}
                        onSuccess={handleEditSuccess}
                      />
                    </div>
                  </CardHeader>

                  {prompt.image_path && (
                    <CardContent>
                      <img
                        src={prompt.image_path}
                        alt={prompt.title}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="bg-muted">
        <CardHeader>
          <CardTitle>🎉 Phase 3.5 Complete!</CardTitle>
          <CardDescription>
            The unified prompt creation system is now fully functional
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">What's Working:</h4>
            <ul className="text-sm space-y-1 list-disc list-inside">
              <li>✅ Create new prompts with multi-step wizard</li>
              <li>✅ Platform selection with search and filters</li>
              <li>✅ Dynamic form fields based on platform</li>
              <li>✅ Validation before submission</li>
              <li>✅ Thumbnail upload to Supabase storage</li>
              <li>✅ Preview with formatted output</li>
              <li>✅ Edit existing prompts</li>
              <li>✅ Load and pre-populate form data</li>
              <li>✅ Update prompts in database</li>
              <li>✅ Error handling and user feedback</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Test the System:</h4>
            <ol className="text-sm space-y-1 list-decimal list-inside">
              <li>Click "Create New Prompt" to add a prompt</li>
              <li>Fill in all steps and submit</li>
              <li>See the new prompt appear in the list</li>
              <li>Click "Edit" on any prompt</li>
              <li>Wizard loads with existing data</li>
              <li>Make changes and update</li>
              <li>See changes reflected in the list</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
