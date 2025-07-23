import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePromptGenerator } from "@/hooks/prompt-generator/usePromptGenerator";
import { useToast } from "@/hooks/use-toast";

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (option: string) => void;
  fieldName: string;
  fieldId: string;
}

export function QuickAddModal({ isOpen, onClose, onAdd, fieldName, fieldId }: QuickAddModalProps) {
  const [newOption, setNewOption] = useState("");
  const [loading, setLoading] = useState(false);
  const { addFieldOption } = usePromptGenerator();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newOption.trim()) {
      toast({
        variant: "destructive",
        title: "Invalid Input",
        description: "Please enter a valid option."
      });
      return;
    }

    setLoading(true);
    try {
      await addFieldOption(fieldId, newOption.trim());
      onAdd(newOption.trim());
      setNewOption("");
      onClose();
      
      toast({
        title: "Option Added",
        description: `"${newOption.trim()}" has been added to ${fieldName}.`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add option. Please try again."
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setNewOption("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New {fieldName} Option</DialogTitle>
          <DialogDescription>
            Add a new option to the {fieldName} field. This will be available for all future prompt generations.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-option" className="text-right">
                Option
              </Label>
              <Input
                id="new-option"
                value={newOption}
                onChange={(e) => setNewOption(e.target.value)}
                placeholder={`Enter new ${fieldName.toLowerCase()} option`}
                className="col-span-3"
                autoFocus
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !newOption.trim()}>
              {loading ? "Adding..." : "Add Option"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}