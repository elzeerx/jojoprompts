import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { createLogger } from '@/utils/logging';

const logger = createLogger('MAGIC_LOGIN_PAGE');

export function MagicLoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleMagicLogin = async () => {
      const token = searchParams.get('token');
      const redirectTo = searchParams.get('redirect') || '/pricing';

      if (!token) {
        setError('Invalid magic link - no token provided');
        setIsLoading(false);
        return;
      }

      try {
        logger.info('Processing magic login', { hasToken: !!token });

        // Call the magic-login edge function
        const { data, error } = await supabase.functions.invoke('magic-login', {
          body: { token }
        });

        if (error) {
          throw new Error(error.message);
        }

        if (!data.success) {
          throw new Error(data.error || 'Magic login failed');
        }

        logger.info('Magic login successful', { hasAuthUrl: !!data.authUrl });

        // The magic login function returns an auth URL that we need to use
        if (data.authUrl) {
          // Redirect to the Supabase auth URL which will authenticate the user
          window.location.href = data.authUrl;
          return;
        }

        // Fallback: redirect to the intended destination
        toast({
          title: "Signed in successfully!",
          description: "Welcome back! You've been automatically signed in.",
        });

        navigate(redirectTo);

      } catch (error: any) {
        logger.error('Magic login failed', { error: error.message || error });
        setError(error.message || 'Failed to process magic login');
        
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: error.message || 'The magic link may have expired or is invalid.',
        });

        // Redirect to login page after error
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } finally {
        setIsLoading(false);
      }
    };

    handleMagicLogin();
  }, [searchParams, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-warm-gold mx-auto mb-4"></div>
          <h2 className="text-2xl font-semibold text-dark-base mb-2">Signing you in...</h2>
          <p className="text-gray-600">Please wait while we process your magic link.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-semibold text-dark-base mb-2">Login Failed</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">You'll be redirected to the login page shortly...</p>
        </div>
      </div>
    );
  }

  return null;
}