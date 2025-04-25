import { FC, useState } from "react";
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
  promptType: "text" | "image";
  onSave: (prompt: Partial<PromptRow>) => Promise<void>;
}

export const PromptDialog: FC<PromptDialogProps> = ({
  open,
  onOpenChange,
  initial,
  promptType,
  onSave,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const { session } = useAuth();
  const form = usePromptForm(initial);

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

      if (promptType === "image" && form.file) {
        const path = `${session?.user.id}/${crypto.randomUUID()}-${form.file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("prompt-images")
          .upload(path, form.file, { upsert: false });

        if (uploadError) {
          throw new Error("Image upload failed");
        }

        imagePath = path;
      }

      if (promptType === "text" && !defaultImagePath) {
        try {
          if (form.file) {
            defaultImagePath = await uploadDefaultPromptImage(form.file);
          } else {
            defaultImagePath = 'text-prompt-default.png';
          }
        } catch (error) {
          console.error('Error uploading default text prompt image:', error);
          toast({
            title: "Error",
            description: "Failed to upload default text prompt image",
            variant: "destructive",
          });
          return;
        }
      }

      let meta = { ...form.metadata };

      try {
        const { data, error } = await supabase.functions.invoke(
          "generate-metadata",
          { body: { prompt_text: form.promptText } }
        );
        if (!error && data) {
          meta = { ...meta, ...data };
        }
        console.log("Metadata generated:", meta);
      } catch (err) {
        console.warn("Metadata generation failed:", err);
      }

      const promptData: Partial<PromptRow> = {
        title: form.title,
        prompt_text: form.promptText,
        prompt_type: promptType,
        metadata: meta,
        image_path: promptType === "image" ? imagePath : null,
        default_image_path: promptType === "text" ? defaultImagePath : null
      };

      await onSave(promptData);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Edit" : "Add"} {promptType === "image" ? "Image" : "Text"}{" "}
            Prompt
          </DialogTitle>
          <DialogDescription>
            {initial
              ? "Update the prompt details below."
              : "Create a new prompt by entering the details below."}
          </DialogDescription>
        </DialogHeader>
        
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

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" onClick={handleSubmit} disabled={submitting}>
            {submitting
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
