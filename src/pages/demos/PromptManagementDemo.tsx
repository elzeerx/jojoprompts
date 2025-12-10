import { useState } from 'react';
import { SimplifiedPromptDialog } from '@/components/prompts';
import { usePromptList } from '@/hooks/usePromptList';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, RefreshCw, Edit } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function PromptManagementDemo() {
  const { prompts, loading, refetch } = usePromptList(10);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);

  const handleSuccess = () => {
    refetch();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Prompt Management System</h2>
          <p className="text-muted-foreground">
            Complete CRUD operations for prompts
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => refetch()}
            disabled={loading}
            variant="outline"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </>
            )}
          </Button>
          
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Prompt
          </Button>
        </div>
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

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingPromptId(prompt.id)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
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

      <SimplifiedPromptDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleSuccess}
      />

      {editingPromptId && (
        <SimplifiedPromptDialog
          open={!!editingPromptId}
          onOpenChange={(open) => !open && setEditingPromptId(null)}
          editingPrompt={{ id: editingPromptId } as any}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
