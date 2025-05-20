
import { FC, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { type PromptRow } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { DialogForm } from "./components/DialogForm";
import { usePromptForm } from "./hooks/usePromptForm";
import { uploadDefaultPromptImage } from "@/utils/image";

export interface PromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: PromptRow | null;
  promptType: "text" | "image" | "button" | "image-selection" | "workflow";
  category?: string;
  onSave: (prompt: Partial<PromptRow>) => Promise<void>;
}

export const PromptDialog: FC<PromptDialogProps> = ({
  open,
  onOpenChange,
  initial,
  promptType,
  category = "ChatGPT",
  onSave,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [generatingMetadata, setGeneratingMetadata] = useState(false);
  const { session } = useAuth();
  const form = usePromptForm(initial);

  // Set default category to the selected one
  useEffect(() => {
    if (!initial && open && (!form.metadata?.category || form.metadata.category === '')) {
      form.setMetadata({ ...form.metadata, category });
    }
  }, [open, initial, category]);

  // Reset form when dialog opens/closes or when initial data changes
  useEffect(() => {
    // Reset the form when the dialog opens with no initial data
    // or when the dialog closes and there was no initial data (we were adding, not editing)
    if (!initial && (!open || form.title || form.promptText)) {
      form.resetForm();
    }
  }, [open, initial]);

  // Get the appropriate accent colors based on category
  const getCategoryColors = () => {
    switch (category) {
      case "ChatGPT": 
        return {
          primary: "bg-warm-gold text-white hover:bg-warm-gold/90",
          secondary: "bg-warm-gold/10 text-warm-gold hover:bg-warm-gold/20",
          accent: "text-warm-gold"
        };
      case "Midjourney": 
        return {
          primary: "bg-muted-teal text-white hover:bg-muted-teal/90",
          secondary: "bg-muted-teal/10 text-muted-teal hover:bg-muted-teal/20",
          accent: "text-muted-teal"
        };
      case "n8n": 
        return {
          primary: "bg-secondary text-white hover:bg-secondary/90",
          secondary: "bg-secondary/10 text-secondary hover:bg-secondary/20",
          accent: "text-secondary"
        };
      default: 
        return {
          primary: "bg-warm-gold text-white hover:bg-warm-gold/90",
          secondary: "bg-warm-gold/10 text-warm-gold hover:bg-warm-gold/20",
          accent: "text-warm-gold"
        };
    }
  };

  const colors = getCategoryColors();

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.promptText.trim()) {
      toast({
        title: "Error",
        description: "Title and Prompt Text are required",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      let imagePath = initial?.image_path ?? "";
      let defaultImagePath = initial?.default_image_path;

      if ((promptType === "image" || promptType === "image-selection") && form.file) {
        const path = `${session?.user.id}/${crypto.randomUUID()}-${form.file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("prompt-images")
          .upload(path, form.file, { upsert: false });

        if (uploadError) {
          throw new Error("Image upload failed");
        }

        imagePath = path;
      } else if (promptType === "text" && form.file) {
        // Use the uploadDefaultPromptImage function for the text prompt custom image
        defaultImagePath = await uploadDefaultPromptImage(form.file);
      } else if (!form.file && form.selectedImagePath) {
        // Use the selected image path if no new file was uploaded but an existing image was selected
        if (promptType === "text") {
          defaultImagePath = form.selectedImagePath;
        } else if (promptType === "image" || promptType === "image-selection") {
          imagePath = form.selectedImagePath;
        }
      } else if (promptType === "text" && !defaultImagePath) {
        // Use the default image if no file was uploaded and no existing image was selected
        defaultImagePath = 'textpromptdefaultimg.jpg';
      }

      console.log(`Using ${promptType} image path: ${promptType === "text" ? defaultImagePath : imagePath}`);

      // Initialize metadata with existing values or empty structure
      let meta = { 
        ...form.metadata, 
        category: form.metadata?.category || category // Ensure category is set
      };

      // Generate metadata for the prompt text
      try {
        setGeneratingMetadata(true);
        console.log("Calling generate-metadata edge function");
        
        const { data, error } = await supabase.functions.invoke(
          "generate-metadata",
          { body: { prompt_text: form.promptText } }
        );
        
        if (error) {
          console.error("Metadata generation error:", error);
          toast({
            title: "Warning",
            description: "Failed to generate metadata automatically. You can still save the prompt with manual metadata.",
            variant: "destructive",
          });
        } else if (data) {
          console.log("Metadata generated successfully:", data);
          // Merge the generated metadata with any existing metadata,
          // but make sure we use one of the main categories
          const generatedCategory = ["ChatGPT", "Midjourney", "n8n"].includes(data.category) 
            ? data.category 
            : (meta.category || category);
          
          meta = { 
            ...meta, 
            category: generatedCategory,
            style: data.style || meta.style || "",
            tags: data.tags?.length ? data.tags : (meta.tags || [])
          };
          form.setMetadata(meta); // Update form state with new metadata
        }
      } catch (err) {
        console.warn("Error during metadata generation:", err);
        // Continue with the save process even if metadata generation fails
      } finally {
        setGeneratingMetadata(false);
      }

      const promptData: Partial<PromptRow> = {
        title: form.title,
        prompt_text: form.promptText,
        prompt_type: promptType,
        metadata: meta,
        image_path: (promptType === "image" || promptType === "image-selection") ? imagePath : null,
        default_image_path: promptType === "text" ? defaultImagePath : null
      };

      await onSave(promptData);
      
      // Reset form after successful save if we're not editing
      if (!initial) {
        form.resetForm();
      }
      
      // Close dialog
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving prompt:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save prompt",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getDialogTitle = () => {
    const action = initial ? "Edit" : "Add";
    switch (promptType) {
      case "text": return `${action} Text Prompt`;
      case "image": return `${action} Image Prompt`;
      case "button": return `${action} Button Prompt`;
      case "image-selection": return `${action} Image Selection`;
      case "workflow": return `${action} Workflow`;
      default: return `${action} Prompt`;
    }
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={(newOpen) => {
        // If dialog is closing and we're not editing, reset the form
        if (!newOpen && !initial) {
          form.resetForm();
        }
        onOpenChange(newOpen);
      }}
    >
      <DialogContent className="sm:max-w-[500px] rounded-xl p-0 bg-background border border-border overflow-hidden">
        <DialogHeader className={`px-6 pt-6 pb-2 border-b border-border`}>
          <DialogTitle className={`text-xl ${colors.accent}`}>
            {getDialogTitle()}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {initial
              ? "Update the prompt details below."
              : "Create a new prompt by entering the details below."}
          </DialogDescription>
        </DialogHeader>
        
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          <DialogForm
            title={form.title}
            promptText={form.promptText}
            metadata={form.metadata}
            promptType={promptType}
            imageURL={form.imageURL}
            file={form.file}
            onTitleChange={form.setTitle}
            onPromptTextChange={form.setPromptText}
            onMetadataChange={form.setMetadata}
            onFileChange={form.setFile}
          />
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border bg-muted/10 flex flex-row justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              // Explicitly reset the form when canceling
              if (!initial) {
                form.resetForm();
              }
              onOpenChange(false);
            }}
            className="rounded-lg border-border"
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            onClick={handleSubmit} 
            disabled={submitting || generatingMetadata}
            className={`rounded-lg ${colors.primary}`}
          >
            {submitting || generatingMetadata
              ? initial
                ? "Saving..."
                : "Adding..."
              : initial
              ? "Save Changes"
              : "Add Prompt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
