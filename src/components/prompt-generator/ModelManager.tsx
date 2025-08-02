import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Settings } from "lucide-react";
import { usePromptGenerator } from "@/hooks/prompt-generator/usePromptGenerator";
import { useToast } from "@/hooks/use-toast";

interface ModelFormData {
  name: string;
  type: "image" | "video";
  parameters: string;
  is_active: boolean;
}

export function ModelManager() {
  const { models, addModel, updateModel, deleteModel } = usePromptGenerator();
  const { toast } = useToast();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<string | null>(null);
  const [formData, setFormData] = useState<ModelFormData>({
    name: "",
    type: "image",
    parameters: "{}",
    is_active: true
  });

  const handleOpenDialog = (modelId?: string) => {
    if (modelId) {
      const model = models.find(m => m.id === modelId);
      if (model) {
        setFormData({
          name: model.name,
          type: model.type,
          parameters: JSON.stringify(model.parameters, null, 2),
          is_active: model.is_active
        });
        setEditingModel(modelId);
      }
    } else {
      setFormData({
        name: "",
        type: "image",
        parameters: "{}",
        is_active: true
      });
      setEditingModel(null);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingModel(null);
    setFormData({
      name: "",
      type: "image",
      parameters: "{}",
      is_active: true
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const parameters = JSON.parse(formData.parameters);
      
      const modelData = {
        name: formData.name,
        type: formData.type,
        parameters,
        is_active: formData.is_active
      };

      if (editingModel) {
        await updateModel(editingModel, modelData);
        toast({
          title: "Model Updated",
          description: "The model has been updated successfully."
        });
      } else {
        await addModel(modelData);
        toast({
          title: "Model Added",
          description: "The new model has been added successfully."
        });
      }
      
      handleCloseDialog();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save model."
      });
    }
  };

  const handleDelete = async (modelId: string) => {
    if (confirm("Are you sure you want to delete this model?")) {
      try {
        await deleteModel(modelId);
        toast({
          title: "Model Deleted",
          description: "The model has been deleted successfully."
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to delete model."
        });
      }
    }
  };

  const handleToggleActive = async (modelId: string, isActive: boolean) => {
    try {
      await updateModel(modelId, { is_active: isActive });
      toast({
        title: "Model Updated",
        description: `Model has been ${isActive ? 'activated' : 'deactivated'}.`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update model status."
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">AI Models</h3>
          <p className="text-sm text-muted-foreground">
            Manage AI models for prompt generation
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Model
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {models.map((model) => (
          <Card key={model.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-base">{model.name}</CardTitle>
                  <CardDescription>
                    <Badge variant="outline" className="mt-1">
                      {model.type}
                    </Badge>
                  </CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenDialog(model.id)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(model.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Active</span>
                  <Switch
                    checked={model.is_active}
                    onCheckedChange={(checked) => handleToggleActive(model.id, checked)}
                  />
                </div>
                <div>
                  <span className="text-sm font-medium">Parameters:</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {Object.keys(model.parameters).map((param) => (
                      <Badge key={param} variant="secondary" className="text-xs">
                        {param}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {models.length === 0 && (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            <Settings className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No models configured yet.</p>
            <p className="text-sm">Add your first AI model to get started.</p>
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingModel ? "Edit Model" : "Add New Model"}
            </DialogTitle>
            <DialogDescription>
              Configure AI model settings and parameters for prompt generation.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Midjourney, FLUX, Runway"
                  className="col-span-3"
                  required
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="type" className="text-right">
                  Type
                </Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, type: value as "image" | "video" }))}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">Image Generation</SelectItem>
                    <SelectItem value="video">Video Generation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="parameters" className="text-right pt-2">
                  Parameters
                </Label>
                <div className="col-span-3">
                  <Textarea
                    id="parameters"
                    value={formData.parameters}
                    onChange={(e) => setFormData(prev => ({ ...prev, parameters: e.target.value }))}
                    placeholder='{"aspect_ratio": ["1:1", "16:9"], "stylize": {"min": 0, "max": 1000}}'
                    rows={8}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    JSON format defining available parameters for this model
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="active" className="text-right">
                  Active
                </Label>
                <Switch
                  id="active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit">
                {editingModel ? "Update Model" : "Add Model"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}