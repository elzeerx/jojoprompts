import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck } from "lucide-react";

// Local typed wrapper: supabase.auth.oauth is beta and may not appear in the
// generated types yet.
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};
const oauth = (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id in URL.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      if (!oauth?.getAuthorizationDetails) {
        setError(
          "OAuth server support is not available in this Supabase client build. Please contact support.",
        );
        return;
      }
      const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message ?? "Could not load authorization request.");
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    try {
      const { data, error } = approve
        ? await oauth.approveAuthorization(authorizationId)
        : await oauth.denyAuthorization(authorizationId);
      if (error) {
        setError(error.message ?? "Request failed.");
        setBusy(false);
        return;
      }
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) {
        setError("No redirect returned by the authorization server.");
        setBusy(false);
        return;
      }
      window.location.href = target;
    } catch (e: any) {
      setError(e?.message ?? "Unexpected error.");
      setBusy(false);
    }
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-soft-bg px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border p-8 text-center">
          <h1 className="text-xl font-semibold text-dark-base mb-2">
            Authorization error
          </h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }

  if (!details) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-soft-bg">
        <Loader2 className="h-6 w-6 animate-spin text-warm-gold" />
      </main>
    );
  }

  const clientName = details.client?.name ?? details.client?.client_name ?? "an app";
  const scopes: string[] = details.scopes ?? details.scope?.split?.(" ") ?? [];

  return (
    <main className="min-h-screen flex items-center justify-center bg-soft-bg px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-2xl border p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-full bg-warm-gold/10 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-warm-gold" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-dark-base">
              Connect {clientName} to JojoPrompts
            </h1>
            <p className="text-xs text-muted-foreground">
              {clientName} is requesting access to act on your behalf.
            </p>
          </div>
        </div>

        {scopes.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Permissions requested
            </p>
            <ul className="text-sm text-dark-base space-y-1">
              {scopes.map((s) => (
                <li key={s} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-warm-gold" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-muted-foreground mb-6">
          Approving lets this app use JojoPrompts APIs as your signed-in user
          account. You can revoke access anytime from your account settings.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => decide(false)}
          >
            Deny
          </Button>
          <Button
            className="bg-warm-gold hover:bg-warm-gold/90 text-white"
            disabled={busy}
            onClick={() => decide(true)}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
          </Button>
        </div>
      </div>
    </main>
  );
}
