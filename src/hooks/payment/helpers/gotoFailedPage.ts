
import { NavigateFunction } from "react-router-dom";

export function gotoFailedPage(
  navigate: NavigateFunction,
  planId: string | null | undefined,
  reason: string,
  delayMs: number = 2000,
  userId?: string,
  setTimeoutFn = setTimeout // for testability
) {
  setTimeoutFn(() => {
    let url = `/payment-failed?reason=${encodeURIComponent(reason)}`;
    if (planId) url += `&planId=${planId}`;
    if (userId) url += `&userId=${userId}`;
    navigate(url);
  }, delayMs);
}
