
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { type PromptRow } from "@/types";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useState } from "react";

interface ImageSelectionFieldsProps {
  metadata: PromptRow["metadata"];
  onMetadataChange: (metadata: PromptRow["metadata"]) => void;
}

export const ImageSelectionFields = ({ metadata, onMetadataChange }: ImageSelectionFieldsProps) => {
  const [newOption, setNewOption] = useState("");
  
  const imageOptions = metadata.image_options || [];
  
  const addOption = () => {
    if (newOption.trim()) {
      const updatedOptions = [...imageOptions, newOption.trim()];
      onMetadataChange({ ...metadata, image_options: updatedOptions });
      setNewOption("");
    }
  };
  
  const removeOption = (index: number) => {
    const updatedOptions = [...imageOptions];
    updatedOptions.splice(index, 1);
    onMetadataChange({ ...metadata, image_options: updatedOptions });
  };

  return (
    <>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label className="text-right">
          Image Options
        </Label>
        <div className="col-span-3 space-y-2">
          <div className="flex items-center gap-2">
            <Input
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              className="rounded-lg"
              placeholder="Add image variant or option"
            />
            <Button type="button" onClick={addOption} variant="secondary">
              Add
            </Button>
          </div>
          
          {imageOptions.length > 0 && (
            <div className="mt-2 space-y-2">
              {imageOptions.map((option, index) => (
                <div key={index} className="flex items-center gap-2 bg-secondary/50 p-2 rounded-md">
                  <span className="flex-1">{option}</span>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => removeOption(index)}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
