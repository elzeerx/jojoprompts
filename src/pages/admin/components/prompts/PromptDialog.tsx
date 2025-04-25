
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { type PromptRow } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

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
  onSave 
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

      let meta = { 
        category: metadata.category || "", 
        style: metadata.style || "", 
        tags: metadata.tags || [],
        target_model: metadata.target_model || "",
        use_case: metadata.use_case || "",
      };

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
            {initial ? "Edit" : "Add"} {promptType === "image" ? "Image" : "Text"} Prompt
          </DialogTitle>
          <DialogDescription>
            {initial ? "Update the prompt details below." : "Create a new prompt by entering the details below."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">
              Title
            </Label>
            <Input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="col-span-3"
            />
          </div>
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
          {promptType === "image" && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="image" className="text-right">
                Image
              </Label>
              <div className="col-span-3 space-y-4">
                <Input
                  type="file"
                  id="image"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="cursor-pointer"
                />
                {(imageURL || file) && (
                  <div className="rounded-lg overflow-hidden bg-muted">
                    <img
                      src={file ? URL.createObjectURL(file) : imageURL}
                      alt="Preview"
                      className="w-full aspect-video object-cover"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
          {promptType === "text" && (
            <>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="target_model" className="text-right">
                  Target Model
                </Label>
                <Select
                  value={metadata.target_model}
                  onValueChange={(value) => setMetadata({ ...metadata, target_model: value })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select target model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                    <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                    <SelectItem value="gpt-4.5-preview">GPT-4.5 Preview</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="use_case" className="text-right">
                  Use Case
                </Label>
                <Input
                  type="text"
                  id="use_case"
                  value={metadata.use_case || ""}
                  onChange={(e) => setMetadata({ ...metadata, use_case: e.target.value })}
                  className="col-span-3"
                  placeholder="e.g., Writing Assistant, Code Helper"
                />
              </div>
            </>
          )}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="category" className="text-right">
              Category
            </Label>
            <Input
              type="text"
              id="category"
              value={metadata.category || ""}
              onChange={(e) => setMetadata({ ...metadata, category: e.target.value })}
              className="col-span-3"
            />
          </div>
          {promptType === "image" && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="style" className="text-right">
                Style
              </Label>
              <Input
                type="text"
                id="style"
                value={metadata.style || ""}
                onChange={(e) => setMetadata({ ...metadata, style: e.target.value })}
                className="col-span-3"
              />
            </div>
          )}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="tags" className="text-right">
              Tags
            </Label>
            <Input
              type="text"
              id="tags"
              placeholder="tag1, tag2, tag3"
              value={metadata.tags?.join(", ") || ""}
              onChange={(e) => {
                const tags = e.target.value.split(",").map(tag => tag.trim()).filter(Boolean);
                setMetadata({ ...metadata, tags });
              }}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (initial ? "Saving..." : "Adding...") : (initial ? "Save Changes" : "Add Prompt")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PromptDialog;
