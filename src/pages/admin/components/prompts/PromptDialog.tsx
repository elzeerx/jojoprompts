
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
import { useState, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { type PromptRow } from "@/types";

interface PromptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onPromptAdded: () => void;
  initial?: PromptRow | null;
}

const EMPTY: PromptRow["metadata"] = {
  category: "",
  style: "",
  tags: []
};

export function PromptDialog({ isOpen, onClose, onPromptAdded, initial }: PromptDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [promptText, setPromptText] = useState("");
  const [metadata, setMetadata] = useState(EMPTY);
  const [imageURL, setImageURL] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    if (initial) {
      // edit mode
      setTitle(initial.title);
      setPromptText(initial.prompt_text);
      setMetadata({
        category: initial.metadata?.category ?? "",
        style: initial.metadata?.style ?? "",
        tags: initial.metadata?.tags ?? []
      });
      setImageURL(initial.image_url ?? "");
    } else {
      // add mode → clear every field
      setTitle("");
      setPromptText("");
      setMetadata(EMPTY);
      setImageURL("");
    }
  }, [isOpen, initial]);

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
      // --- generate metadata (optional) --------------
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

      const promptData = {
        title: title,
        prompt_text: promptText,
        metadata: {
          category: meta.category || metadata.category,
          style: meta.style || metadata.style,
          tags: meta.tags.length ? meta.tags : metadata.tags,
        },
        image_url: imageURL || null,
      };

      let error;

      if (initial) {
        // Update existing prompt
        const { error: updateError } = await supabase
          .from("prompts")
          .update(promptData)
          .eq("id", initial.id);
        error = updateError;
      } else {
        // Insert new prompt
        const { error: insertError } = await supabase.from("prompts").insert({
          ...promptData,
          user_id: (await supabase.auth.getUser()).data.user?.id,
        });
        error = insertError;
      }

      console.log("[PROMPT_DIALOG]", { error });
      
      if (error) throw error;

      toast({
        title: "Success",
        description: initial ? "Prompt updated successfully" : "Prompt added successfully",
      });
      
      onClose();
      onPromptAdded();
    } catch (error) {
      console.error("Error saving prompt:", error);
      toast({
        title: "Error",
        description: initial ? "Failed to update prompt" : "Failed to add prompt",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
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
            <Label htmlFor="category" className="text-right">
              Category
            </Label>
            <Input
              type="text"
              id="category"
              value={metadata.category}
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
              value={metadata.style}
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
              value={metadata.tags.join(", ")}
              onChange={(e) => setMetadata({ 
                ...metadata, 
                tags: e.target.value.split(",").map(tag => tag.trim()).filter(Boolean)
              })}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="image_url" className="text-right">
              Image URL
            </Label>
            <Input
              type="text"
              id="image_url"
              value={imageURL}
              onChange={(e) => setImageURL(e.target.value)}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
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
}

