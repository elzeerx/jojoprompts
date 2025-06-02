
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  prompt_count?: number;
}

export interface CollectionWithPrompts extends Collection {
  prompts: Array<{
    id: string;
    title: string;
    prompt_type: string;
    added_at: string;
  }>;
}

export function useCollections() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const { session } = useAuth();

  const fetchCollections = async () => {
    if (!session) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('collections')
        .select(`
          *,
          collection_prompts(count)
        `)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const collectionsWithCount = data.map(collection => ({
        ...collection,
        prompt_count: collection.collection_prompts?.[0]?.count || 0
      }));

      setCollections(collectionsWithCount);
    } catch (error) {
      console.error('Error fetching collections:', error);
      toast({
        title: "Error",
        description: "Failed to load collections",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createCollection = async (name: string, description?: string, isPublic = false) => {
    if (!session) return null;

    try {
      const { data, error } = await supabase
        .from('collections')
        .insert({
          user_id: session.user.id,
          name,
          description,
          is_public: isPublic
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "Collection created successfully",
      });

      await fetchCollections();
      return data;
    } catch (error) {
      console.error('Error creating collection:', error);
      toast({
        title: "Error",
        description: "Failed to create collection",
        variant: "destructive",
      });
      return null;
    }
  };

  const updateCollection = async (id: string, updates: Partial<Collection>) => {
    try {
      const { error } = await supabase
        .from('collections')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Collection updated successfully",
      });

      await fetchCollections();
    } catch (error) {
      console.error('Error updating collection:', error);
      toast({
        title: "Error",
        description: "Failed to update collection",
        variant: "destructive",
      });
    }
  };

  const deleteCollection = async (id: string) => {
    try {
      const { error } = await supabase
        .from('collections')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Collection deleted successfully",
      });

      await fetchCollections();
    } catch (error) {
      console.error('Error deleting collection:', error);
      toast({
        title: "Error",
        description: "Failed to delete collection",
        variant: "destructive",
      });
    }
  };

  const addPromptToCollection = async (collectionId: string, promptId: string) => {
    try {
      const { error } = await supabase
        .from('collection_prompts')
        .insert({
          collection_id: collectionId,
          prompt_id: promptId
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Prompt added to collection",
      });

      await fetchCollections();
    } catch (error) {
      console.error('Error adding prompt to collection:', error);
      toast({
        title: "Error",
        description: "Failed to add prompt to collection",
        variant: "destructive",
      });
    }
  };

  const removePromptFromCollection = async (collectionId: string, promptId: string) => {
    try {
      const { error } = await supabase
        .from('collection_prompts')
        .delete()
        .eq('collection_id', collectionId)
        .eq('prompt_id', promptId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Prompt removed from collection",
      });

      await fetchCollections();
    } catch (error) {
      console.error('Error removing prompt from collection:', error);
      toast({
        title: "Error",
        description: "Failed to remove prompt from collection",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchCollections();
  }, [session]);

  return {
    collections,
    loading,
    fetchCollections,
    createCollection,
    updateCollection,
    deleteCollection,
    addPromptToCollection,
    removePromptFromCollection,
  };
}
