
import { toast } from "@/hooks/use-toast";
import { gotoFailedPage } from "./gotoFailedPage";

export function handleVerificationError({
  errorTitle,
  errorMsg,
  toastMsg,
  variant = "destructive",
  navigate,
  planId,
  userId,
  setError,
  setVerifying,
  gotoFailedOverride,
}: {
  errorTitle: string,
  errorMsg: string,
  toastMsg?: string,
  variant?: "destructive" | "default",
  navigate: any,
  planId: string,
  userId: string,
  setError: (s: string | null) => void,
  setVerifying: (b: boolean) => void,
  gotoFailedOverride?: string
}) {
  setError(errorMsg);
  setVerifying(false);
  toast({
    title: errorTitle,
    description: toastMsg || errorMsg,
    variant,
  });
  gotoFailedPage(navigate, planId, gotoFailedOverride || errorMsg, 2000, userId);
}
