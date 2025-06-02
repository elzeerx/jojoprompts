
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookmarkPlus, Plus } from "lucide-react";
import { useCollections } from "@/hooks/useCollections";
import { CreateCollectionDialog } from "./CreateCollectionDialog";

interface AddToCollectionDialogProps {
  promptId: string;
  trigger?: React.ReactNode;
}

export function AddToCollectionDialog({ promptId, trigger }: AddToCollectionDialogProps) {
  const [open, setOpen] = useState(false);
  const { collections, addPromptToCollection } = useCollections();

  const handleAddToCollection = async (collectionId: string) => {
    await addPromptToCollection(collectionId, promptId);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="border-warm-gold/20 hover:bg-warm-gold/10">
            <BookmarkPlus className="h-4 w-4 mr-2" />
            Add to Collection
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-background border border-warm-gold/20">
        <DialogHeader>
          <DialogTitle>Add to Collection</DialogTitle>
          <DialogDescription>
            Select a collection to add this prompt to, or create a new one.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3">
          {collections.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <p className="mb-4">You don't have any collections yet.</p>
              <CreateCollectionDialog 
                trigger={
                  <Button className="bg-warm-gold hover:bg-warm-gold/90 text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Collection
                  </Button>
                }
                onSuccess={() => setOpen(false)}
              />
            </div>
          ) : (
            <>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {collections.map((collection) => (
                  <div
                    key={collection.id}
                    className="flex items-center justify-between p-3 border border-warm-gold/20 rounded-lg hover:bg-warm-gold/5 cursor-pointer"
                    onClick={() => handleAddToCollection(collection.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{collection.name}</h4>
                      {collection.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {collection.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <Badge variant="secondary" className="text-xs">
                        {collection.prompt_count || 0}
                      </Badge>
                      {collection.is_public && (
                        <Badge variant="outline" className="text-xs">
                          Public
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="pt-3 border-t border-warm-gold/20">
                <CreateCollectionDialog 
                  trigger={
                    <Button variant="outline" className="w-full border-warm-gold/20">
                      <Plus className="h-4 w-4 mr-2" />
                      Create New Collection
                    </Button>
                  }
                  onSuccess={() => setOpen(false)}
                />
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
