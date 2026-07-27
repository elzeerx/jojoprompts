import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

/**
 * V2 release-hardening: the legacy `/payment/upayments-callback` route and
 * its dependency on the retired `process-upayments-payment` Edge Function
 * have been removed. Any legacy return traffic is redirected to the V2
 * payment callback surface (`/payment/callback`), which reconciles state via
 * `v2-upayments-status`.
 */
export default function UpaymentCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    navigate(`/payment/callback${search}`, { replace: true });
  }, [navigate]);

  return (
    <main className="container mx-auto flex min-h-[240px] items-center justify-center px-4 py-8">
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-2 text-sm text-muted-foreground"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Finalizing your payment…
      </div>
    </main>
  );
}
