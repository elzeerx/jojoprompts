
export async function fetchPaypalOrder(baseUrl: string, accessToken: string, orderId: string) {
  const orderRes = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    }
  });
  const orderData = await orderRes.json();
  return { ok: orderRes.ok, data: orderData };
}

export async function capturePaypalOrder(baseUrl: string, accessToken: string, orderId: string) {
  const captureRes = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    }
  });
  const captureData = await captureRes.json();
  return { ok: captureRes.ok, data: captureData };
}

export async function fetchPaypalPaymentCapture(baseUrl: string, accessToken: string, paymentId: string) {
  const paymentRes = await fetch(`${baseUrl}/v2/payments/captures/${paymentId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    }
  });
  const paymentData = await paymentRes.json();
  return { ok: paymentRes.ok, data: paymentData };
}
