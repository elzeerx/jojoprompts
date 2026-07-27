/**
 * V2 release-hardening: the retired `verify-paypal-payment` Edge Function is
 * no longer invoked. This helper is retained as a stub so historical imports
 * continue to type-check; it always returns a `retired` error without any
 * network I/O.
 */
export async function verifyPayPalPayment(
  _token: string,
  _payerId: string,
  _accessToken?: string,
) {
  return {
    data: null,
    error: {
      message:
        'verify-paypal-payment is retired. Use the V2 payment surface (v2-upayments-*).',
      retired: true,
    },
  };
}
