
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Category, CategoryFormData } from "@/types/category";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
  onSave: (data: Omit<Category, 'id' | 'created_at' | 'updated_at'> | { id: string, data: Partial<Category> }) => Promise<void>;
  onClose: () => void;
}

const iconOptions = [
  "Sparkles", "Zap", "Workflow", "Image", "Video", "Music", 
  "Code", "Palette", "Bot", "Brain", "Cpu", "Database"
];

const planOptions = ["basic", "standard", "premium"];

const gradientOptions = [
  "from-warm-gold/20 via-warm-gold/10 to-transparent",
  "from-muted-teal/20 via-muted-teal/10 to-transparent",
  "from-blue-500/20 via-blue-500/10 to-transparent",
  "from-green-500/20 via-green-500/10 to-transparent",
  "from-purple-500/20 via-purple-500/10 to-transparent",
  "from-red-500/20 via-red-500/10 to-transparent",
];

export function CategoryDialog({
  open,
  onOpenChange,
  category,
  onSave,
  onClose,
}: CategoryDialogProps) {
  const [formData, setFormData] = useState<CategoryFormData>({
    name: "",
    description: "",
    image_path: "",
    required_plan: "basic",
    icon_name: "Sparkles",
    features: [],
    bg_gradient: "from-warm-gold/20 via-warm-gold/10 to-transparent",
    link_path: "",
    is_active: true,
  });
  const [newFeature, setNewFeature] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name,
        description: category.description || "",
        image_path: category.image_path || "",
        required_plan: category.required_plan,
        icon_name: category.icon_name,
        features: category.features || [],
        bg_gradient: category.bg_gradient,
        link_path: category.link_path,
        is_active: category.is_active,
      });
    } else {
      setFormData({
        name: "",
        description: "",
        image_path: "",
        required_plan: "basic",
        icon_name: "Sparkles",
        features: [],
        bg_gradient: "from-warm-gold/20 via-warm-gold/10 to-transparent",
        link_path: "",
        is_active: true,
      });
    }
  }, [category, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (category) {
        await onSave({ id: category.id, data: formData });
      } else {
        const maxDisplayOrder = 10; // We'll calculate this properly later
        await onSave({
          ...formData,
          display_order: maxDisplayOrder + 1,
        });
      }
      onClose();
    } catch (error) {
      console.error("Error saving category:", error);
    } finally {
      setLoading(false);
    }
  };

  const addFeature = () => {
    if (newFeature.trim() && !formData.features.includes(newFeature.trim())) {
      setFormData(prev => ({
        ...prev,
        features: [...prev.features, newFeature.trim()]
      }));
      setNewFeature("");
    }
  };

  const removeFeature = (featureToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.filter(f => f !== featureToRemove)
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {category ? "Edit Category" : "Create Category"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="link_path">Link Path</Label>
              <Input
                id="link_path"
                value={formData.link_path}
                onChange={(e) => setFormData(prev => ({ ...prev, link_path: e.target.value }))}
                placeholder="/prompts/category-name"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="image_path">Image Path</Label>
            <Input
              id="image_path"
              value={formData.image_path}
              onChange={(e) => setFormData(prev => ({ ...prev, image_path: e.target.value }))}
              placeholder="/lovable-uploads/image.jpg"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Required Plan</Label>
              <Select
                value={formData.required_plan}
                onValueChange={(value) => setFormData(prev => ({ ...prev, required_plan: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {planOptions.map(plan => (
                    <SelectItem key={plan} value={plan} className="capitalize">
                      {plan}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Icon</Label>
              <Select
                value={formData.icon_name}
                onValueChange={(value) => setFormData(prev => ({ ...prev, icon_name: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {iconOptions.map(icon => (
                    <SelectItem key={icon} value={icon}>
                      {icon}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Background Gradient</Label>
              <Select
                value={formData.bg_gradient}
                onValueChange={(value) => setFormData(prev => ({ ...prev, bg_gradient: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {gradientOptions.map((gradient, index) => (
                    <SelectItem key={index} value={gradient}>
                      Gradient {index + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Features</Label>
            <div className="flex gap-2 mb-2">
              <Input
                value={newFeature}
                onChange={(e) => setNewFeature(e.target.value)}
                placeholder="Add a feature"
                onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addFeature())}
              />
              <Button type="button" onClick={addFeature} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.features.map((feature, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                  {feature}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => removeFeature(feature)}
                  />
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
            />
            <Label htmlFor="is_active">Active</Label>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
