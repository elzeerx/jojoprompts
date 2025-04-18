import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PlusCircle, Trash, Edit, AlertCircle } from "lucide-react";
import { type Prompt } from "@/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";

export default function PromptsManagement() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPrompt, setEditingPrompt] = useState<null | Prompt>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    prompt_text: "",
    category: "",
    style: "",
    tags: "",
    image_url: "",
  });
  const { user } = useAuth();

  useEffect(() => {
    fetchPrompts();
  }, []);

  const fetchPrompts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("prompts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const transformedData = data?.map(item => ({
        id: item.id,
        user_id: item.user_id,
        title: item.title,
        prompt_text: item.prompt_text,
        image_url: item.image_url,
        created_at: item.created_at || "",
        metadata: typeof item.metadata === 'object' ? 
          {
            category: item.metadata?.category as string || undefined,
            style: item.metadata?.style as string || undefined,
            tags: Array.isArray(item.metadata?.tags) ? item.metadata?.tags as string[] : []
          } : { category: undefined, style: undefined, tags: [] }
      })) || [];

      setPrompts(transformedData);
    } catch (error) {
      console.error("Error fetching prompts:", error);
      toast({
        title: "Error",
        description: "Failed to load prompts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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
        metadata = meta ?? {};
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
          category: metadata.category ?? formData.category,
          style: metadata.style ?? formData.style,
          tags: metadata.tags ?? tags,
        },
        image_url: formData.image_url || null,
        user_id: user?.id,
      });

      if (error) throw error;

      await fetchPrompts();
      setIsDialogOpen(false);
      resetForm();
      
      toast({
        title: "Success",
        description: "Prompt added successfully",
      });
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

  const handleUpdatePrompt = async () => {
    if (!editingPrompt || !user) return;
    
    try {
      const tags = formData.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

      const updatedPrompt = {
        title: formData.title,
        prompt_text: formData.prompt_text,
        image_url: formData.image_url || null,
        metadata: {
          category: formData.category,
          style: formData.style,
          tags,
        },
      };

      const { error } = await supabase
        .from("prompts")
        .update(updatedPrompt)
        .match({ id: editingPrompt.id });

      if (error) throw error;

      setPrompts((prev) =>
        prev.map((p) =>
          p.id === editingPrompt.id
            ? {
                ...p,
                title: formData.title,
                prompt_text: formData.prompt_text,
                image_url: formData.image_url || null,
                metadata: {
                  category: formData.category,
                  style: formData.style,
                  tags,
                },
              }
            : p
        )
      );

      setIsDialogOpen(false);
      setEditingPrompt(null);
      resetForm();
      
      toast({
        title: "Success",
        description: "Prompt updated successfully",
      });
    } catch (error) {
      console.error("Error updating prompt:", error);
      toast({
        title: "Error",
        description: "Failed to update prompt",
        variant: "destructive",
      });
    }
  };

  const handleDeletePrompt = async (id: string) => {
    try {
      const { error } = await supabase.from("prompts").delete().match({ id });

      if (error) throw error;

      setPrompts((prev) => prev.filter((p) => p.id !== id));
      
      toast({
        title: "Success",
        description: "Prompt deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting prompt:", error);
      toast({
        title: "Error",
        description: "Failed to delete prompt",
        variant: "destructive",
      });
    }
  };

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

  const openAddDialog = () => {
    resetForm();
    setEditingPrompt(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (prompt: Prompt) => {
    setEditingPrompt(prompt);
    setFormData({
      title: prompt.title,
      prompt_text: prompt.prompt_text,
      category: prompt.metadata.category || "",
      style: prompt.metadata.style || "",
      tags: prompt.metadata.tags?.join(", ") || "",
      image_url: prompt.image_url || "",
    });
    setIsDialogOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Manage Prompts</h2>
        <Button onClick={openAddDialog}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Prompt
        </Button>
      </div>

      {loading ? (
        <p>Loading prompts...</p>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {prompts.map((prompt) => (
            <Card key={prompt.id}>
              <CardHeader>
                <CardTitle>{prompt.title}</CardTitle>
                <CardDescription>
                  Category: {prompt.metadata.category || "N/A"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {prompt.prompt_text.substring(0, 100)}...
                </p>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openEditDialog(prompt)}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. Are you sure you want to
                        delete this prompt?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeletePrompt(prompt.id)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingPrompt ? "Edit Prompt" : "Add Prompt"}
            </DialogTitle>
            <DialogDescription>
              {editingPrompt
                ? "Make changes to your prompt here. Click save when you're done."
                : "Create a new prompt by entering the details below."}
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
            <Button 
              type="button" 
              variant="secondary" 
              onClick={() => setIsDialogOpen(false)}
            >
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
    </div>
  );
}
