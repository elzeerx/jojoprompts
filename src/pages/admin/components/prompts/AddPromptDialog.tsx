
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
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { type PromptRow } from "@/types";

interface AddPromptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onPromptAdded: () => void;
}

export function AddPromptDialog({ isOpen, onClose, onPromptAdded }: AddPromptDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    prompt_text: "",
    category: "",
    style: "",
    tags: "",
    image_url: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      title: "",
      prompt_text: "",
      category: "",
      style: "",
      tags: "",
      image_url: "",
    });
  };

  const handleAddPrompt = async () => {
    if (!formData.title || !formData.prompt_text) {
      toast({
        title: "Error",
        description: "Title and Prompt Text are required",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      let metadata = {};
      try {
        const { data: meta } = await supabase.functions.invoke(
          "generate-metadata",
          { body: { prompt_text: formData.prompt_text } }
        );
        metadata = meta || {};
      } catch (e) {
        console.warn("Metadata generation failed:", e);
      }

      const tags = formData.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

      const { error } = await supabase.from("prompts").insert({
        title: formData.title,
        prompt_text: formData.prompt_text,
        metadata: {
          category: metadata.category || formData.category,
          style: metadata.style || formData.style,
          tags: metadata.tags || tags,
        },
        image_url: formData.image_url || null,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Prompt added successfully",
      });
      
      onClose();
      resetForm();
      onPromptAdded();
    } catch (error) {
      console.error("Error adding prompt:", error);
      toast({
        title: "Error",
        description: "Failed to add prompt",
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
          <DialogTitle>Add Prompt</DialogTitle>
          <DialogDescription>
            Create a new prompt by entering the details below.
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
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="prompt_text" className="text-right">
              Prompt Text
            </Label>
            <Textarea
              id="prompt_text"
              name="prompt_text"
              value={formData.prompt_text}
              onChange={handleChange}
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
              name="category"
              value={formData.category}
              onChange={handleChange}
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
              name="style"
              value={formData.style}
              onChange={handleChange}
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
              name="tags"
              placeholder="tag1, tag2, tag3"
              value={formData.tags}
              onChange={handleChange}
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
              name="image_url"
              value={formData.image_url}
              onChange={handleChange}
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
            onClick={handleAddPrompt}
            disabled={submitting}
          >
            {submitting ? "Adding..." : "Add Prompt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
