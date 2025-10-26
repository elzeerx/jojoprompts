import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Validation schemas for payment edge functions
export const ProcessPaymentCreateSchema = z.object({
  action: z.literal('create'),
  planId: z.string().uuid('Invalid plan ID format'),
  userId: z.string().uuid('Invalid user ID format'),
  amount: z.number().min(0, 'Amount must be non-negative').max(999999, 'Amount exceeds maximum'),
  appliedDiscount: z.object({
    id: z.string().uuid('Invalid discount ID format'),
    code: z.string().min(1).max(50),
    discount_value: z.number().min(0).max(100)
  }).optional().nullable(),
  isUpgrade: z.boolean().optional(),
  upgradingFromPlanId: z.string().uuid('Invalid upgrading plan ID format').optional().nullable(),
  currentSubscriptionId: z.string().uuid('Invalid subscription ID format').optional().nullable()
});

export const ProcessPaymentCaptureSchema = z.object({
  action: z.literal('capture'),
  orderId: z.string().min(1, 'Order ID is required').max(255),
  planId: z.string().uuid('Invalid plan ID format'),
  userId: z.string().uuid('Invalid user ID format'),
  amount: z.number().min(0).max(999999).optional(),
  appliedDiscount: z.object({
    id: z.string().uuid('Invalid discount ID format'),
    code: z.string().min(1).max(50)
  }).optional().nullable(),
  isUpgrade: z.boolean().optional(),
  currentSubscriptionId: z.string().uuid('Invalid subscription ID format').optional().nullable()
});

export const ProcessPaymentDirectActivationSchema = z.object({
  action: z.literal('direct-activation'),
  planId: z.string().uuid('Invalid plan ID format'),
  userId: z.string().uuid('Invalid user ID format'),
  amount: z.literal(0, { errorMap: () => ({ message: 'Amount must be 0 for direct activation' }) }),
  appliedDiscount: z.object({
    id: z.string().uuid('Invalid discount ID format'),
    code: z.string().min(1).max(50),
    discount_value: z.number().min(0).max(100)
  })
});

export const ResendPaymentEmailSchema = z.object({
  transactionId: z.string().uuid('Invalid transaction ID format'),
  email: z.string().email('Invalid email address').max(255, 'Email too long')
});

export const VerifyPaymentSchema = z.object({
  orderId: z.string().min(1).max(255).optional(),
  paymentId: z.string().min(1).max(255).optional(),
  planId: z.string().uuid('Invalid plan ID format').optional(),
  userId: z.string().uuid('Invalid user ID format').optional()
}).refine(
  (data) => data.orderId || data.paymentId,
  { message: 'Either orderId or paymentId must be provided' }
);

// Helper function to validate and return typed data
export function validatePaymentInput<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      return { success: false, error: `Validation failed: ${errorMessages}` };
    }
    return { success: false, error: 'Invalid input data' };
  }
}
