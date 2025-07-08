
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { type PromptRow } from "@/types";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface WorkflowFieldsProps {
  metadata: PromptRow["metadata"];
  onMetadataChange: (metadata: PromptRow["metadata"]) => void;
}

export const WorkflowFields = ({ metadata, onMetadataChange }: WorkflowFieldsProps) => {
  const workflowSteps = metadata.workflow_steps || [];
  
  const addStep = () => {
    const updatedSteps = [...workflowSteps, { name: "", description: "" }];
    onMetadataChange({ ...metadata, workflow_steps: updatedSteps });
  };
  
  const removeStep = (index: number) => {
    const updatedSteps = [...workflowSteps];
    updatedSteps.splice(index, 1);
    onMetadataChange({ ...metadata, workflow_steps: updatedSteps });
  };
  
  const updateStep = (index: number, field: 'name' | 'description', value: string) => {
    const updatedSteps = [...workflowSteps];
    updatedSteps[index] = { ...updatedSteps[index], [field]: value };
    onMetadataChange({ ...metadata, workflow_steps: updatedSteps });
  };

  return (
    <>
      <div className="grid grid-cols-4 items-start gap-4">
        <Label className="text-right pt-2">
          Workflow Steps
        </Label>
        <div className="col-span-3 space-y-4">
          {workflowSteps.length > 0 ? (
            workflowSteps.map((step, index) => (
              <div key={index} className="border border-border rounded-md p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Step {index + 1}</h4>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => removeStep(index)}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor={`step-name-${index}`} className="text-xs">Step Name</Label>
                  <Input
                    id={`step-name-${index}`}
                    value={step.name}
                    onChange={(e) => updateStep(index, 'name', e.target.value)}
                    className="h-8"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor={`step-desc-${index}`} className="text-xs">Description</Label>
                  <Textarea
                    id={`step-desc-${index}`}
                    value={step.description}
                    onChange={(e) => updateStep(index, 'description', e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-3 text-muted-foreground">
              No workflow steps added yet
            </div>
          )}
          
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={addStep}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" /> Add Step
          </Button>
        </div>
      </div>
    </>
  );
};
