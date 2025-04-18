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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { type PromptRow } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

export interface PromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: PromptRow | null;
  onSave: (prompt: Partial<PromptRow>) => Promise<void>;
}

const EMPTY: PromptRow["metadata"] = {
  category: "",
  style: "",
  tags: []
};

export const PromptDialog: FC<PromptDialogProps> = ({ open, onOpenChange, initial, onSave }) => {
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
        tags: initial.metadata?.tags ?? []
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

      if (file) {
        const path = `${session?.user.id}/${crypto.randomUUID()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("prompt-images")
          .upload(path, file, { upsert: false });

        if (uploadError) {
          throw new Error("Image upload failed");
        }

        imagePath = path;
      }

      let meta = { category: "", style: "", tags: [] as string[] };
      try {
        const { data, error } = await supabase.functions.invoke(
          "generate-metadata",
          { body: { prompt_text: promptText } }
        );
        if (!error && data) meta = data as typeof meta;
        console.log("Metadata generated:", meta);
      } catch (err) {
        console.warn("Metadata generation failed:", err);
      }

      const promptData: Partial<PromptRow> = {
        title: title,
        prompt_text: promptText,
        metadata: {
          category: meta.category || metadata.category,
          style: meta.style || metadata.style,
          tags: meta.tags.length ? meta.tags : metadata.tags,
        },
        image_path: imagePath,
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
          <DialogTitle>{initial ? "Edit Prompt" : "Add Prompt"}</DialogTitle>
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
