# verify-paypal-payment helpers

`dbOperations.ts` exposes utility functions used by PayPal related edge functions.

## `getTransaction`

Retrieves the most recent PayPal transaction that matches supplied identifiers.
When both `paypal_order_id` and `paypal_payment_id` are provided the lookup now
requires **both** columns to match the same row. Supplying only one ID still
performs a simple equality filter on that column.
