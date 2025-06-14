
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function usePayPalClientId() {
  const [clientId, setClientId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getPayPalClientId = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-paypal-client-id');
        
        if (error) {
          console.error('[PayPal] Failed to get client ID:', error);
          setError('Failed to initialize PayPal payment system');
          return;
        }
        
        setClientId(data.clientId);
      } catch (error) {
        console.error('[PayPal] Error getting client ID:', error);
        setError('Payment system unavailable');
      }
    };

    getPayPalClientId();
  }, []);

  return { clientId, error };
}
