import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Bot, Image as ImageIcon, Palette, Workflow, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const defaultCategories = [
  { value: "chatgpt-text", label: "ChatGPT Text", icon: MessageSquare },
  { value: "chatgpt-image", label: "ChatGPT Image", icon: ImageIcon },
  { value: "claude-text", label: "Claude Text", icon: Bot },
  { value: "midjourney-prompt", label: "Midjourney Prompt", icon: Palette },
  { value: "midjourney-style", label: "Midjourney Style", icon: Palette },
  { value: "n8n-workflow", label: "n8n Workflow", icon: Workflow }
];

interface CategorySelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function CategorySelector({ value, onChange }: CategorySelectorProps) {
  const { toast } = useToast();
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const allCategories = [
    ...defaultCategories.map(c => c.value),
    ...customCategories
  ];

  const addCustomCategory = () => {
    if (!newCategory.trim()) {
      toast({
        variant: "destructive",
        title: "Invalid input",
        description: "Please enter a category name."
      });
      return;
    }

    const categoryValue = newCategory.trim().toLowerCase().replace(/\s+/g, '-');
    
    if (allCategories.includes(categoryValue)) {
      toast({
        variant: "destructive",
        title: "Category exists",
        description: "This category already exists."
      });
      return;
    }

    setCustomCategories(prev => [...prev, categoryValue]);
    onChange(categoryValue);
    setNewCategory("");
    setIsDialogOpen(false);
    
    toast({
      title: "Category added",
      description: `Custom category "${newCategory}" has been added.`
    });
  };

  const getCategoryIcon = (categoryValue: string) => {
    const defaultCategory = defaultCategories.find(c => c.value === categoryValue);
    return defaultCategory ? defaultCategory.icon : Bot;
  };

  const formatCategoryLabel = (categoryValue: string) => {
    const defaultCategory = defaultCategories.find(c => c.value === categoryValue);
    if (defaultCategory) return defaultCategory.label;
    
    // Format custom category: "my-custom-category" -> "My Custom Category"
    return categoryValue
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Category</Label>
      <div className="flex gap-2">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {defaultCategories.map((category) => {
              const Icon = category.icon;
              return (
                <SelectItem key={category.value} value={category.value}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {category.label}
                  </div>
                </SelectItem>
              );
            })}
            {customCategories.length > 0 && (
              <>
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground border-t">
                  Custom Categories
                </div>
                {customCategories.map((category) => {
                  const Icon = getCategoryIcon(category);
                  return (
                    <SelectItem key={category} value={category}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {formatCategoryLabel(category)}
                      </div>
                    </SelectItem>
                  );
                })}
              </>
            )}
          </SelectContent>
        </Select>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Custom Category</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-category">Category Name</Label>
                <Input
                  id="new-category"
                  placeholder="e.g., DALL-E Prompts, Stable Diffusion, Custom AI..."
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustomCategory()}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={addCustomCategory} className="mobile-button-primary">
                  Add Category
                </Button>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}