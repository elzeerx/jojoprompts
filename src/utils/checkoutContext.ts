import { createLogger } from './logging';

const logger = createLogger('CHECKOUT_CONTEXT');

// Context preservation utilities for checkout flow
interface CheckoutContext {
  planId?: string;
  fromCheckout?: boolean;
  timestamp: number;
  appliedDiscount?: {
    id: string;
    code: string;
    discount_type: string;
    discount_value: number;
  } | null;
}

const CONTEXT_KEY = 'jojo_checkout_context';
const CONTEXT_EXPIRY = 30 * 60 * 1000; // 30 minutes

export class CheckoutContextManager {
  static saveContext(context: Omit<CheckoutContext, 'timestamp'>) {
    const contextWithTimestamp: CheckoutContext = {
      ...context,
      timestamp: Date.now()
    };
    
    try {
      sessionStorage.setItem(CONTEXT_KEY, JSON.stringify(contextWithTimestamp));
      localStorage.setItem(CONTEXT_KEY + '_backup', JSON.stringify(contextWithTimestamp));
    } catch (error) {
      logger.warn('Failed to save checkout context', { error });
    }
  }

  static getContext(): CheckoutContext | null {
    try {
      // Try sessionStorage first
      let contextStr = sessionStorage.getItem(CONTEXT_KEY);
      
      // Fallback to localStorage
      if (!contextStr) {
        contextStr = localStorage.getItem(CONTEXT_KEY + '_backup');
      }

      if (!contextStr) return null;

      const context: CheckoutContext = JSON.parse(contextStr);
      
      // Check if context has expired
      if (Date.now() - context.timestamp > CONTEXT_EXPIRY) {
        this.clearContext();
        return null;
      }

      return context;
    } catch (error) {
      logger.warn('Failed to retrieve checkout context', { error });
      return null;
    }
  }

  static clearContext() {
    try {
      sessionStorage.removeItem(CONTEXT_KEY);
      localStorage.removeItem(CONTEXT_KEY + '_backup');
    } catch (error) {
      logger.warn('Failed to clear checkout context', { error });
    }
  }

  static updateContext(updates: Partial<CheckoutContext>) {
    const existing = this.getContext() || { timestamp: Date.now() };
    this.saveContext({ ...existing, ...updates });
  }

  static buildCheckoutUrl(planId?: string, fromSignup?: boolean): string {
    const params = new URLSearchParams();
    if (planId) params.append('plan_id', planId);
    if (fromSignup) params.append('from_signup', 'true');
    
    return `/checkout${params.toString() ? '?' + params.toString() : ''}`;
  }

  static buildRedirectUrl(origin: string, planId?: string, fromSignup?: boolean): string {
    return `${origin}${this.buildCheckoutUrl(planId, fromSignup)}`;
  }
}