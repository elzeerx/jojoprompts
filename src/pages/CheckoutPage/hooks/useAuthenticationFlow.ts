
import { useEffect, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { logInfo, logDebug } from '@/utils/secureLogging';

export function useAuthenticationFlow(
  user: any,
  authLoading: boolean,
  loading: boolean,
  selectedPlan: any,
  authCallback: string | null,
  setShowAuthForm: any
) {
  useEffect(() => {
    logDebug("Auth state effect triggered", "checkout", { 
      hasUser: !!user, 
      authLoading, 
      loading, 
      selectedPlanName: selectedPlan?.name, 
      authCallback 
    }, user?.id);
    
    if (!authLoading && !loading && selectedPlan) {
      if (!user) {
        logInfo("No user found, showing auth form", "checkout");
        setShowAuthForm(true);
      } else {
        logInfo("User authenticated, hiding auth form", "checkout", undefined, user.id);
        setShowAuthForm(false);
        
        // If this is a Google OAuth callback, clean up the URL
        if (authCallback === 'google') {
          logInfo("Handling Google OAuth callback", "checkout", undefined, user.id);
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('auth_callback');
          window.history.replaceState({}, document.title, newUrl.toString());
          
          toast({
            title: "Welcome!",
            description: "Successfully signed in with Google. Complete your purchase below.",
          });
        }
      }
    }
  }, [user, authLoading, loading, selectedPlan, authCallback, setShowAuthForm]);

  const handleAuthSuccess = useCallback(() => {
    logInfo("Auth success callback triggered", "checkout", undefined, user?.id);
    setShowAuthForm(false);
    toast({
      title: "Success!",
      description: "Account ready. You can now complete your purchase.",
    });
  }, [user?.id, setShowAuthForm]);

  return {
    handleAuthSuccess
  };
}
