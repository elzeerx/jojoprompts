import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { BookOpen, Eye, Trash2, Share } from "lucide-react";
import { usePromptGenerator } from "@/hooks/prompt-generator/usePromptGenerator";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export function TemplateManager() {
  const { templates, error, canManagePrompts } = usePromptGenerator();
  const { toast } = useToast();

  if (!canManagePrompts) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>You need admin, prompter, or jadmin role to manage templates.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error Loading Templates</CardTitle>
          <CardDescription className="text-destructive">{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);

  const handleTogglePublic = async (templateId: string, isPublic: boolean) => {
    try {
      // Update template public status logic would go here
      toast({
        title: "Template Updated",
        description: `Template has been made ${isPublic ? 'public' : 'private'}.`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update template status."
      });
    }
  };

  const handleDelete = async (templateId: string) => {
    if (confirm("Are you sure you want to delete this template?")) {
      try {
        // Delete template logic would go here
        toast({
          title: "Template Deleted",
          description: "The template has been deleted successfully."
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to delete template."
        });
      }
    }
  };

  const publicTemplates = templates.filter(t => t.is_public);
  const privateTemplates = templates.filter(t => !t.is_public);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Template Management</h3>
          <p className="text-sm text-muted-foreground">
            Manage saved prompt templates for quick reuse
          </p>
        </div>
      </div>

      {/* Private Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">My Templates</CardTitle>
          <CardDescription>
            Your private templates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {privateTemplates.map((template) => (
              <div key={template.id} className="flex justify-between items-center p-3 border rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{template.name}</span>
                    <Badge variant="outline">
                      {template.model_type}
                    </Badge>
                  </div>
                  {template.description && (
                    <p className="text-sm text-muted-foreground">
                      {template.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Public</span>
                    <Switch
                      checked={template.is_public}
                      onCheckedChange={(checked) => handleTogglePublic(template.id, checked)}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreviewTemplate(template)}
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(template.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            {privateTemplates.length === 0 && (
              <div className="text-center py-4 text-muted-foreground">
                <p>No private templates yet.</p>
                <p className="text-sm">Generate prompts and save them as templates.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Public Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Public Templates</CardTitle>
          <CardDescription>
            Templates shared with the community
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {publicTemplates.map((template) => (
              <div key={template.id} className="flex justify-between items-center p-3 border rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{template.name}</span>
                    <Badge variant="outline">
                      {template.model_type}
                    </Badge>
                    <Badge className="bg-green-100 text-green-800">
                      <Share className="h-3 w-3 mr-1" />
                      Public
                    </Badge>
                  </div>
                  {template.description && (
                    <p className="text-sm text-muted-foreground">
                      {template.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreviewTemplate(template)}
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleTogglePublic(template.id, false)}
                  >
                    <Share className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            {publicTemplates.length === 0 && (
              <div className="text-center py-4 text-muted-foreground">
                <p>No public templates yet.</p>
                <p className="text-sm">Make some of your templates public to share with others.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {templates.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <BookOpen className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>No templates saved yet.</p>
          <p className="text-sm">Generate prompts and save them as templates for quick reuse.</p>
        </div>
      )}

      {/* Template Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{previewTemplate?.name}</DialogTitle>
            <DialogDescription>
              {previewTemplate?.description || "Template preview"}
            </DialogDescription>
          </DialogHeader>
          
          {previewTemplate && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Badge variant="outline">
                  {previewTemplate.model_type}
                </Badge>
                {previewTemplate.is_public && (
                  <Badge className="bg-green-100 text-green-800">
                    Public
                  </Badge>
                )}
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Template Data:</h4>
                <ScrollArea className="h-[300px] w-full rounded-md border p-4">
                  <pre className="text-sm">
                    {JSON.stringify(previewTemplate.template_data, null, 2)}
                  </pre>
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}