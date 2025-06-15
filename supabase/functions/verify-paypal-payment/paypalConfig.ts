
export function getPayPalConfig(envProvider = Deno.env) {
  const clientId = envProvider.get('PAYPAL_CLIENT_ID');
  const clientSecret = envProvider.get('PAYPAL_CLIENT_SECRET');
  const env = envProvider.get('PAYPAL_ENVIRONMENT') || 'sandbox';
  const baseUrl = env === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
  return { clientId, clientSecret, baseUrl };
}
