
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TextPromptFields } from "./TextPromptFields";
import { ImageUploadField } from "./ImageUploadField";
import { ButtonPromptFields } from "./ButtonPromptFields";
import { ImageSelectionFields } from "./ImageSelectionFields";
import { WorkflowFields } from "./WorkflowFields";
import { PromptFormField } from "./PromptFormField";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface DialogFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEditing: boolean;
  formData: any;
  onFormDataChange: (field: string, value: any) => void;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function DialogForm({
  open,
  onOpenChange,
  isEditing,
  formData,
  onFormDataChange,
  isSubmitting,
  onSubmit
}: DialogFormProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Prompt" : "Create New Prompt"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update the prompt details below." : "Fill in the details to create a new prompt."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => onFormDataChange("title", e.target.value)}
                placeholder="Enter prompt title"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="promptType">Prompt Type</Label>
              <Select
                value={formData.prompt_type}
                onValueChange={(value) => onFormDataChange("prompt_type", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select prompt type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text (ChatGPT)</SelectItem>
                  <SelectItem value="image">Image (Midjourney)</SelectItem>
                  <SelectItem value="workflow">Workflow (n8n)</SelectItem>
                  <SelectItem value="button">Button</SelectItem>
                  <SelectItem value="image-selection">Image Selection</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={formData.metadata?.category || ""}
              onValueChange={(value) => onFormDataChange("metadata", { ...formData.metadata, category: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ChatGPT">ChatGPT</SelectItem>
                <SelectItem value="Midjourney">Midjourney</SelectItem>
                <SelectItem value="n8n">n8n Workflow</SelectItem>
                <SelectItem value="General">General</SelectItem>
                <SelectItem value="Business">Business</SelectItem>
                <SelectItem value="Creative">Creative</SelectItem>
                <SelectItem value="Technical">Technical</SelectItem>
                <SelectItem value="Marketing">Marketing</SelectItem>
                <SelectItem value="Education">Education</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <PromptFormField
            value={formData.prompt_text}
            onChange={(value) => onFormDataChange("prompt_text", value)}
          />

          {formData.prompt_type === "text" && (
            <TextPromptFields
              metadata={formData.metadata}
              onChange={(metadata) => onFormDataChange("metadata", metadata)}
            />
          )}

          {(formData.prompt_type === "image" || formData.prompt_type === "workflow") && (
            <ImageUploadField
              currentImage={formData.image_path}
              onImageChange={(imagePath) => onFormDataChange("image_path", imagePath)}
            />
          )}

          {formData.prompt_type === "button" && (
            <ButtonPromptFields
              metadata={formData.metadata}
              onChange={(metadata) => onFormDataChange("metadata", metadata)}
            />
          )}

          {formData.prompt_type === "image-selection" && (
            <ImageSelectionFields
              metadata={formData.metadata}
              onChange={(metadata) => onFormDataChange("metadata", metadata)}
            />
          )}

          {formData.prompt_type === "workflow" && (
            <WorkflowFields
              metadata={formData.metadata}
              onChange={(metadata) => onFormDataChange("metadata", metadata)}
            />
          )}

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-warm-gold hover:bg-warm-gold/90">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? "Updating..." : "Creating..."}
                </>
              ) : (
                isEditing ? "Update Prompt" : "Create Prompt"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
