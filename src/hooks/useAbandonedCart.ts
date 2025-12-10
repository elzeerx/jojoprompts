import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useAbandonedCart() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const startSequence = async (userId: string, planId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-abandoned-cart-email', {
        body: { action: 'start_sequence', user_id: userId, plan_id: planId },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error);
      }

      return { success: true, sequence: data.sequence };
    } catch (error: any) {
      console.error('Error starting abandoned cart sequence:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const processQueue = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-abandoned-cart-email', {
        body: { action: 'process_queue' },
      });

      if (error) throw error;

      toast({
        title: 'Queue Processed',
        description: `Processed ${data.processed} emails`,
      });

      return { success: true, processed: data.processed, errors: data.errors };
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    startSequence,
    processQueue,
  };
}
