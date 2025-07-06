// Auth helper functions for URL detection and validation

export const checkPasswordReset = (search: string) => {
  const urlParams = new URLSearchParams(search);
  const type = urlParams.get('type');
  const token = urlParams.get('access_token') || urlParams.get('token');
  return type === 'recovery' && token;
};

export const checkSignupConfirmation = (search: string) => {
  const urlParams = new URLSearchParams(search);
  return urlParams.get('from_signup') === 'true';
};

export const checkPaymentCallback = (pathname: string, search: string) => {
  return pathname.includes('/payment') || 
         search.includes('success=') ||
         search.includes('payment_id=') ||
         search.includes('order_id=');
};

export const getSignupConfirmationParams = (search: string) => {
  const urlParams = new URLSearchParams(search);
  return {
    planId: urlParams.get('plan_id')
  };
};