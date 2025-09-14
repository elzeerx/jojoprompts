import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, FileText, Image, Video, Workflow, Code, Music } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const defaultTypes = [
  { value: "text", label: "Text", icon: FileText },
  { value: "image", label: "Image", icon: Image },
  { value: "video", label: "Video", icon: Video },
  { value: "workflow", label: "Workflow", icon: Workflow },
  { value: "json", label: "JSON/Code", icon: Code },
  { value: "audio", label: "Audio", icon: Music }
];

interface PromptTypeSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function PromptTypeSelector({ value, onChange }: PromptTypeSelectorProps) {
  const { toast } = useToast();
  const [customTypes, setCustomTypes] = useState<string[]>([]);
  const [newType, setNewType] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const allTypes = [
    ...defaultTypes.map(t => t.value),
    ...customTypes
  ];

  const addCustomType = () => {
    if (!newType.trim()) {
      toast({
        variant: "destructive",
        title: "Invalid input",
        description: "Please enter a type name."
      });
      return;
    }

    if (allTypes.includes(newType.toLowerCase())) {
      toast({
        variant: "destructive",
        title: "Type exists",
        description: "This prompt type already exists."
      });
      return;
    }

    setCustomTypes(prev => [...prev, newType.trim().toLowerCase()]);
    onChange(newType.trim().toLowerCase());
    setNewType("");
    setIsDialogOpen(false);
    
    toast({
      title: "Type added",
      description: `Custom prompt type "${newType}" has been added.`
    });
  };

  const getTypeIcon = (typeValue: string) => {
    const defaultType = defaultTypes.find(t => t.value === typeValue);
    return defaultType ? defaultType.icon : FileText;
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Prompt Type</Label>
      <div className="flex gap-2">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select prompt type" />
          </SelectTrigger>
          <SelectContent>
            {defaultTypes.map((type) => {
              const Icon = type.icon;
              return (
                <SelectItem key={type.value} value={type.value}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {type.label}
                  </div>
                </SelectItem>
              );
            })}
            {customTypes.length > 0 && (
              <>
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground border-t">
                  Custom Types
                </div>
                {customTypes.map((type) => {
                  const Icon = getTypeIcon(type);
                  return (
                    <SelectItem key={type} value={type}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {type.charAt(0).toUpperCase() + type.slice(1)}
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
              <DialogTitle>Add Custom Prompt Type</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-type">Type Name</Label>
                <Input
                  id="new-type"
                  placeholder="e.g., 3d-model, animation, script..."
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustomType()}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={addCustomType} className="mobile-button-primary">
                  Add Type
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