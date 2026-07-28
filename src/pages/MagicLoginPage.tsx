import { Navigate, useSearchParams } from "react-router-dom";
import { resolveSafeNext } from "@/lib/v2/safeNext";

/**
 * Compatibility route for legacy JojoPrompts custom magic-login links.
 *
 * V2 uses Supabase Auth's built-in `signInWithOtp` links exclusively. Old
 * custom `?token=` links must never be exchanged through the retired
 * service-role Edge Function. Send the visitor to the normal sign-in surface
 * and preserve only a same-origin V2 destination.
 */
export function MagicLoginPage() {
  const [searchParams] = useSearchParams();
  const safeNext = resolveSafeNext(
    searchParams.get("next") ?? searchParams.get("redirect"),
  );

  return (
    <Navigate
      to={`/login?next=${encodeURIComponent(safeNext)}`}
      replace
    />
  );
}

export default MagicLoginPage;
