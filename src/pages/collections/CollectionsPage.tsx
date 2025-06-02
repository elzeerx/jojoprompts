
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCollections, Collection } from "@/hooks/useCollections";
import { CollectionCard } from "@/components/collections/CollectionCard";
import { CreateCollectionDialog } from "@/components/collections/CreateCollectionDialog";
import { Search, Plus, BookOpen } from "lucide-react";

export default function CollectionsPage() {
  const { collections, loading, deleteCollection } = useCollections();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCollections = collections.filter(collection =>
    collection.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    collection.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeleteCollection = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this collection?')) {
      await deleteCollection(id);
    }
  };

  if (loading) {
    return (
      <div className="container max-w-6xl mx-auto py-8 px-4">
        <div className="flex items-center justify-center py-16">
          <p className="text-muted-foreground">Loading collections...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">My Collections</h1>
            <p className="text-muted-foreground">
              Organize your favorite prompts into collections
            </p>
          </div>
          <CreateCollectionDialog />
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search collections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 border-warm-gold/20 focus:border-warm-gold"
          />
        </div>
      </div>

      {collections.length === 0 ? (
        <Card className="border border-warm-gold/20">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Collections Yet</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Start organizing your prompts by creating your first collection. 
              Collections help you group related prompts together for easy access.
            </p>
            <CreateCollectionDialog 
              trigger={
                <Button className="bg-warm-gold hover:bg-warm-gold/90 text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Collection
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : filteredCollections.length === 0 ? (
        <Card className="border border-warm-gold/20">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Search className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Results Found</h3>
            <p className="text-muted-foreground text-center">
              No collections match your search criteria.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCollections.map((collection) => (
            <CollectionCard
              key={collection.id}
              collection={collection}
              onDelete={handleDeleteCollection}
              onView={(collection) => {
                // Navigate to collection view (can be implemented later)
                console.log('View collection:', collection);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
