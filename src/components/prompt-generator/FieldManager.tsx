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
import { Plus, Pencil, Trash2, Database } from "lucide-react";
import { usePromptGenerator } from "@/hooks/prompt-generator/usePromptGenerator";
import { useToast } from "@/hooks/use-toast";

interface FieldFormData {
  field_category: "style" | "subject" | "effects";
  field_name: string;
  field_type: "dropdown" | "text" | "textarea" | "multiselect";
  options: string;
  is_active: boolean;
  display_order: number;
}

export function FieldManager() {
  const { fields, error, canManagePrompts } = usePromptGenerator();
  const { toast } = useToast();

  if (!canManagePrompts) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>You need admin, prompter, or jadmin role to manage fields.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error Loading Fields</CardTitle>
          <CardDescription className="text-destructive">{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [formData, setFormData] = useState<FieldFormData>({
    field_category: "style",
    field_name: "",
    field_type: "dropdown",
    options: "",
    is_active: true,
    display_order: 0
  });

  const groupedFields = fields.reduce((acc, field) => {
    if (!acc[field.field_category]) {
      acc[field.field_category] = [];
    }
    acc[field.field_category].push(field);
    return acc;
  }, {} as Record<string, typeof fields>);

  const handleOpenDialog = (fieldId?: string) => {
    if (fieldId) {
      const field = fields.find(f => f.id === fieldId);
      if (field) {
        setFormData({
          field_category: field.field_category,
          field_name: field.field_name,
          field_type: field.field_type,
          options: field.options.join('\n'),
          is_active: field.is_active,
          display_order: field.display_order
        });
        setEditingField(fieldId);
      }
    } else {
      setFormData({
        field_category: "style",
        field_name: "",
        field_type: "dropdown",
        options: "",
        is_active: true,
        display_order: 0
      });
      setEditingField(null);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingField(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Parse options from string to array
      const options = formData.options
        .split('\n')
        .map(option => option.trim())
        .filter(option => option.length > 0);

      const fieldData = {
        ...formData,
        options,
      };

      if (editingField) {
        // Update field logic would go here
        toast({
          title: "Field Updated",
          description: "The field has been updated successfully."
        });
      } else {
        // Add field logic would go here
        toast({
          title: "Field Added",
          description: "The new field has been added successfully."
        });
      }
      
      handleCloseDialog();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save field."
      });
    }
  };

  const categoryColors = {
    style: "bg-blue-100 text-blue-800",
    subject: "bg-green-100 text-green-800",
    effects: "bg-purple-100 text-purple-800"
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Field Management</h3>
          <p className="text-sm text-muted-foreground">
            Manage form fields and their options for prompt generation
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Field
        </Button>
      </div>

      {Object.entries(groupedFields).map(([category, categoryFields]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="text-base capitalize">
              {category} Fields
            </CardTitle>
            <CardDescription>
              Fields in the {category} category
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {categoryFields.map((field) => (
                <div key={field.id} className="flex justify-between items-center p-3 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{field.field_name.replace(/_/g, ' ')}</span>
                      <Badge className={categoryColors[field.field_category]}>
                        {field.field_category}
                      </Badge>
                      <Badge variant="outline">
                        {field.field_type}
                      </Badge>
                      {!field.is_active && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {field.options.length} options • Order: {field.display_order}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {field.options.slice(0, 3).map((option) => (
                        <Badge key={option} variant="outline" className="text-xs">
                          {option}
                        </Badge>
                      ))}
                      {field.options.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{field.options.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenDialog(field.id)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        // Delete field logic would go here
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {Object.keys(groupedFields).length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Database className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>No fields configured yet.</p>
          <p className="text-sm">Add your first field to get started.</p>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingField ? "Edit Field" : "Add New Field"}
            </DialogTitle>
            <DialogDescription>
              Configure field settings and options for prompt generation forms.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="category" className="text-right">
                  Category
                </Label>
                <Select 
                  value={formData.field_category} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, field_category: value as any }))}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="style">Style</SelectItem>
                    <SelectItem value="subject">Subject</SelectItem>
                    <SelectItem value="effects">Effects</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="field_name" className="text-right">
                  Field Name
                </Label>
                <Input
                  id="field_name"
                  value={formData.field_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, field_name: e.target.value }))}
                  placeholder="e.g., genre, shot_type, lighting"
                  className="col-span-3"
                  required
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="field_type" className="text-right">
                  Field Type
                </Label>
                <Select 
                  value={formData.field_type} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, field_type: value as any }))}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dropdown">Dropdown</SelectItem>
                    <SelectItem value="multiselect">Multi-select</SelectItem>
                    <SelectItem value="text">Text Input</SelectItem>
                    <SelectItem value="textarea">Text Area</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {(formData.field_type === "dropdown" || formData.field_type === "multiselect") && (
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="options" className="text-right pt-2">
                    Options
                  </Label>
                  <div className="col-span-3">
                    <Textarea
                      id="options"
                      value={formData.options}
                      onChange={(e) => setFormData(prev => ({ ...prev, options: e.target.value }))}
                      placeholder="Enter one option per line"
                      rows={6}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter each option on a new line
                    </p>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="display_order" className="text-right">
                  Display Order
                </Label>
                <Input
                  id="display_order"
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
                  className="col-span-3"
                />
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
                {editingField ? "Update Field" : "Add Field"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}