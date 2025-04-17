import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Search, Edit, Trash2, Sparkles, Wand2, Loader2 } from "lucide-react";
import { type Prompt } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const mockPrompts: Prompt[] = [
  // ... keep existing mock data
];

export default function PromptsManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [newPrompt, setNewPrompt] = useState({
    title: "",
    prompt_text: "",
    image_url: "",
    category: "",
    style: "",
    tags: ""
  });
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deletingPromptId, setDeletingPromptId] = useState<string | null>(null);
  const [isGeneratingMetadata, setIsGeneratingMetadata] = useState(false);
  const [isSuggestingPrompt, setIsSuggestingPrompt] = useState(false);

  const filteredPrompts = searchQuery
    ? mockPrompts.filter(prompt => 
        prompt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prompt.prompt_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prompt.metadata.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : mockPrompts;

  const handleAddPrompt = () => {
    console.log("Adding new prompt:", newPrompt);
    // This will be replaced with actual Supabase database call
    
    // Reset form and close dialog
    setNewPrompt({
      title: "",
      prompt_text: "",
      image_url: "",
      category: "",
      style: "",
      tags: ""
    });
    setIsAddDialogOpen(false);
  };

  const handleUpdatePrompt = () => {
    if (!editingPrompt) return;
    
    console.log("Updating prompt:", editingPrompt);
    // This will be replaced with actual Supabase database call
    
    // Reset editing state
    setEditingPrompt(null);
  };

  const handleDeletePrompt = () => {
    if (!deletingPromptId) return;
    
    console.log("Deleting prompt with ID:", deletingPromptId);
    // This will be replaced with actual Supabase database call
    
    // Reset deletion state
    setDeletingPromptId(null);
  };

  const handleGenerateMetadata = async () => {
    try {
      setIsGeneratingMetadata(true);
      const response = await supabase.functions.invoke('generate-metadata', {
        body: { prompt_text: newPrompt.prompt_text }
      });
      
      if (response.error) throw response.error;
      
      const metadata = response.data;
      setNewPrompt(prev => ({
        ...prev,
        category: metadata.category,
        style: metadata.style,
        tags: metadata.tags.join(', ')
      }));
    } catch (error) {
      console.error('Error generating metadata:', error);
      toast({
        title: "Error",
        description: "Failed to generate metadata. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingMetadata(false);
    }
  };

  const handleSuggestPrompt = async () => {
    try {
      setIsSuggestingPrompt(true);
      const response = await supabase.functions.invoke('suggest-prompt', {
        body: {}
      });
      
      if (response.error) throw response.error;
      
      const suggestion = response.data;
      setNewPrompt({
        title: suggestion.title || '',
        prompt_text: suggestion.prompt_text,
        image_url: '',
        category: suggestion.metadata.category,
        style: suggestion.metadata.style,
        tags: suggestion.metadata.tags.join(', ')
      });
      setIsAddDialogOpen(true);
    } catch (error) {
      console.error('Error suggesting prompt:', error);
      toast({
        title: "Error",
        description: "Failed to suggest prompt. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSuggestingPrompt(false);
    }
  };

  const deletingPrompt = deletingPromptId 
    ? mockPrompts.find(p => p.id === deletingPromptId) 
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search prompts..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="whitespace-nowrap">
              <Plus className="mr-2 h-4 w-4" />
              Add Prompt
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Add New Prompt</DialogTitle>
              <DialogDescription>
                Create a new prompt for AI image generation
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={newPrompt.title}
                  onChange={(e) => setNewPrompt({...newPrompt, title: e.target.value})}
                  placeholder="Prompt title"
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="prompt">Prompt Text</Label>
                <Textarea
                  id="prompt"
                  rows={5}
                  value={newPrompt.prompt_text}
                  onChange={(e) => setNewPrompt({...newPrompt, prompt_text: e.target.value})}
                  placeholder="Write your prompt text here..."
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="image">Image URL (optional)</Label>
                <Input
                  id="image"
                  type="url"
                  value={newPrompt.image_url}
                  onChange={(e) => setNewPrompt({...newPrompt, image_url: e.target.value})}
                  placeholder="https://example.com/image.jpg"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={newPrompt.category}
                    onChange={(e) => setNewPrompt({...newPrompt, category: e.target.value})}
                    placeholder="e.g., Fantasy"
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="style">Style</Label>
                  <Input
                    id="style"
                    value={newPrompt.style}
                    onChange={(e) => setNewPrompt({...newPrompt, style: e.target.value})}
                    placeholder="e.g., Watercolor"
                  />
                </div>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="tags">Tags (comma separated)</Label>
                <Input
                  id="tags"
                  value={newPrompt.tags}
                  onChange={(e) => setNewPrompt({...newPrompt, tags: e.target.value})}
                  placeholder="e.g., landscape, mountain, sunset"
                />
              </div>
              
              <div className="flex gap-2">
                <Button 
                  className="flex-1"
                  variant="outline"
                  onClick={handleGenerateMetadata}
                  disabled={!newPrompt.prompt_text || isGeneratingMetadata}
                >
                  {isGeneratingMetadata ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Metadata
                    </>
                  )}
                </Button>

                <Button 
                  className="flex-1"
                  variant="outline"
                  onClick={handleSuggestPrompt}
                  disabled={isSuggestingPrompt}
                >
                  {isSuggestingPrompt ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Suggesting...
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-2 h-4 w-4" />
                      Suggest Prompt
                    </>
                  )}
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddPrompt}>Save Prompt</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead className="hidden md:table-cell">Category</TableHead>
              <TableHead className="hidden md:table-cell">Style</TableHead>
              <TableHead className="hidden lg:table-cell">Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPrompts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                  No prompts found. Try adjusting your search or add a new prompt.
                </TableCell>
              </TableRow>
            ) : (
              filteredPrompts.map((prompt) => (
                <TableRow key={prompt.id}>
                  <TableCell className="font-medium">{prompt.title}</TableCell>
                  <TableCell className="hidden md:table-cell">{prompt.metadata.category}</TableCell>
                  <TableCell className="hidden md:table-cell">{prompt.metadata.style}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {new Date(prompt.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Dialog open={!!editingPrompt} onOpenChange={(open) => !open && setEditingPrompt(null)}>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingPrompt(prompt)}
                          >
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                        </DialogTrigger>
                        {editingPrompt && (
                          <DialogContent className="sm:max-w-[600px]">
                            <DialogHeader>
                              <DialogTitle>Edit Prompt</DialogTitle>
                              <DialogDescription>
                                Update the prompt details
                              </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                              <div className="grid gap-2">
                                <Label htmlFor="edit-title">Title</Label>
                                <Input
                                  id="edit-title"
                                  value={editingPrompt.title}
                                  onChange={(e) => setEditingPrompt({
                                    ...editingPrompt, 
                                    title: e.target.value
                                  })}
                                />
                              </div>
                              
                              <div className="grid gap-2">
                                <Label htmlFor="edit-prompt">Prompt Text</Label>
                                <Textarea
                                  id="edit-prompt"
                                  rows={5}
                                  value={editingPrompt.prompt_text}
                                  onChange={(e) => setEditingPrompt({
                                    ...editingPrompt, 
                                    prompt_text: e.target.value
                                  })}
                                />
                              </div>
                              
                              <div className="grid gap-2">
                                <Label htmlFor="edit-image">Image URL</Label>
                                <Input
                                  id="edit-image"
                                  type="url"
                                  value={editingPrompt.image_url || ""}
                                  onChange={(e) => setEditingPrompt({
                                    ...editingPrompt, 
                                    image_url: e.target.value || null
                                  })}
                                />
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                  <Label htmlFor="edit-category">Category</Label>
                                  <Input
                                    id="edit-category"
                                    value={editingPrompt.metadata.category || ""}
                                    onChange={(e) => setEditingPrompt({
                                      ...editingPrompt,
                                      metadata: {
                                        ...editingPrompt.metadata,
                                        category: e.target.value
                                      }
                                    })}
                                  />
                                </div>
                                
                                <div className="grid gap-2">
                                  <Label htmlFor="edit-style">Style</Label>
                                  <Input
                                    id="edit-style"
                                    value={editingPrompt.metadata.style || ""}
                                    onChange={(e) => setEditingPrompt({
                                      ...editingPrompt,
                                      metadata: {
                                        ...editingPrompt.metadata,
                                        style: e.target.value
                                      }
                                    })}
                                  />
                                </div>
                              </div>
                              
                              <div className="grid gap-2">
                                <Label htmlFor="edit-tags">Tags (comma separated)</Label>
                                <Input
                                  id="edit-tags"
                                  value={editingPrompt.metadata.tags?.join(", ") || ""}
                                  onChange={(e) => setEditingPrompt({
                                    ...editingPrompt,
                                    metadata: {
                                      ...editingPrompt.metadata,
                                      tags: e.target.value.split(",").map(tag => tag.trim())
                                    }
                                  })}
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setEditingPrompt(null)}>
                                Cancel
                              </Button>
                              <Button onClick={handleUpdatePrompt}>Save Changes</Button>
                            </DialogFooter>
                          </DialogContent>
                        )}
                      </Dialog>
                      
                      <AlertDialog open={deletingPromptId === prompt.id} onOpenChange={(open) => !open && setDeletingPromptId(null)}>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => setDeletingPromptId(prompt.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Prompt</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{deletingPrompt?.title}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setDeletingPromptId(null)}>
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground"
                              onClick={handleDeletePrompt}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
