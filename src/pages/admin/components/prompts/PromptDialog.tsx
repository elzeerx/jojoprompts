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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { type PromptRow } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { TextPromptFields } from "./components/TextPromptFields";
import { ImageUploadField } from "./components/ImageUploadField";
import { PromptFormField } from "./components/PromptFormField";
import { Label } from "@/components/ui/label";

export interface PromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: PromptRow | null;
  promptType: "text" | "image";
  onSave: (prompt: Partial<PromptRow>) => Promise<void>;
}

const EMPTY: PromptRow["metadata"] = {
  category: "",
  style: "",
  tags: [],
  target_model: "",
  use_case: "",
};

export const PromptDialog: FC<PromptDialogProps> = ({
  open,
  onOpenChange,
  initial,
  promptType,
  onSave,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [promptText, setPromptText] = useState("");
  const [metadata, setMetadata] = useState<PromptRow["metadata"]>(EMPTY);
  const [imageURL, setImageURL] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const { session } = useAuth();

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitle(initial.title);
      setPromptText(initial.prompt_text);
      setMetadata({
        category: initial.metadata?.category ?? "",
        style: initial.metadata?.style ?? "",
        tags: initial.metadata?.tags ?? [],
        target_model: initial.metadata?.target_model ?? "",
        use_case: initial.metadata?.use_case ?? "",
      });
      setImageURL(initial.image_path ?? "");
    } else {
      setTitle("");
      setPromptText("");
      setMetadata(EMPTY);
      setImageURL("");
      setFile(null);
    }
  }, [open, initial]);

  const handleSubmit = async () => {
    if (!title.trim() || !promptText.trim()) {
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

      if (promptType === "image" && file) {
        const path = `${session?.user.id}/${crypto.randomUUID()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("prompt-images")
          .upload(path, file, { upsert: false });

        if (uploadError) {
          throw new Error("Image upload failed");
        }

        imagePath = path;
      }

      let meta = { ...metadata };

      try {
        const { data, error } = await supabase.functions.invoke(
          "generate-metadata",
          { body: { prompt_text: promptText } }
        );
        if (!error && data) {
          meta = { ...meta, ...data };
        }
        console.log("Metadata generated:", meta);
      } catch (err) {
        console.warn("Metadata generation failed:", err);
      }

      const promptData: Partial<PromptRow> = {
        title,
        prompt_text: promptText,
        prompt_type: promptType,
        metadata: meta,
        image_path: promptType === "image" ? imagePath : null,
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
        <div className="grid gap-4 py-4">
          <PromptFormField
            id="title"
            label="Title"
            value={title}
            onChange={setTitle}
          />
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="prompt_text" className="text-right">
              Prompt Text
            </Label>
            <Textarea
              id="prompt_text"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              className="col-span-3"
            />
          </div>

          {promptType === "image" ? (
            <ImageUploadField
              imageURL={imageURL}
              file={file}
              onFileChange={setFile}
            />
          ) : (
            <TextPromptFields
              metadata={metadata}
              onMetadataChange={setMetadata}
            />
          )}

          <PromptFormField
            id="category"
            label="Category"
            value={metadata.category || ""}
            onChange={(value) => setMetadata({ ...metadata, category: value })}
          />

          {promptType === "image" && (
            <PromptFormField
              id="style"
              label="Style"
              value={metadata.style || ""}
              onChange={(value) => setMetadata({ ...metadata, style: value })}
            />
          )}

          <PromptFormField
            id="tags"
            label="Tags"
            value={metadata.tags?.join(", ") || ""}
            onChange={(value) => {
              const tags = value
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean);
              setMetadata({ ...metadata, tags });
            }}
            placeholder="tag1, tag2, tag3"
          />
        </div>
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
