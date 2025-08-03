import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { setupTestEnvironment, createMockError, mockSafeLog } from '../../utils/testUtils';
import { PaymentErrorBoundary } from '../PaymentErrorBoundary';

// Mock dependencies
jest.mock('../../utils/safeLogging', () => ({
  safeLog: mockSafeLog
}));

// Component that throws a payment error
const ThrowPaymentError = () => {
  throw new Error('Payment processing failed');
};

describe('PaymentErrorBoundary', () => {
  setupTestEnvironment();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Payment Error Boundary Functionality', () => {
    it('should render children when no error occurs', () => {
      render(
        <PaymentErrorBoundary>
          <div>Payment content</div>
        </PaymentErrorBoundary>
      );

      expect(screen.getByText('Payment content')).toBeInTheDocument();
    });

    it('should catch payment errors and show payment-specific error UI', () => {
      render(
        <PaymentErrorBoundary>
          <ThrowPaymentError />
        </PaymentErrorBoundary>
      );

      expect(screen.getByText('Payment Processing Error')).toBeInTheDocument();
      expect(screen.getByText('We encountered an issue while processing your payment. Don\'t worry, your payment information is secure.')).toBeInTheDocument();
    });

    it('should log payment-specific error details', () => {
      render(
        <PaymentErrorBoundary>
          <ThrowPaymentError />
        </PaymentErrorBoundary>
      );

      expect(mockSafeLog.error).toHaveBeenCalledWith('Payment error boundary caught an error:', expect.objectContaining({
        error: 'Payment processing failed',
        errorId: expect.stringMatching(/^payment_error_/),
        location: expect.any(String),
        userAgent: expect.any(String)
      }));
    });

    it('should generate payment-specific error ID', () => {
      const { rerender } = render(
        <PaymentErrorBoundary>
          <ThrowPaymentError />
        </PaymentErrorBoundary>
      );

      const firstErrorId = mockSafeLog.error.mock.calls[0][1].errorId;

      // Render again to trigger another error
      rerender(
        <PaymentErrorBoundary>
          <ThrowPaymentError />
        </PaymentErrorBoundary>
      );

      const secondErrorId = mockSafeLog.error.mock.calls[1][1].errorId;

      expect(firstErrorId).toMatch(/^payment_error_/);
      expect(secondErrorId).toMatch(/^payment_error_/);
      expect(firstErrorId).not.toBe(secondErrorId);
    });
  });

  describe('Payment Context Display', () => {
    it('should display payment context when provided', () => {
      const paymentContext = {
        planId: 'test-plan-123',
        orderId: 'test-order-456',
        paymentId: 'test-payment-789'
      };

      render(
        <PaymentErrorBoundary paymentContext={paymentContext}>
          <ThrowPaymentError />
        </PaymentErrorBoundary>
      );

      expect(screen.getByText('Payment Details:')).toBeInTheDocument();
      expect(screen.getByText('Plan ID: test-plan-123')).toBeInTheDocument();
      expect(screen.getByText('Order ID: test-order-456')).toBeInTheDocument();
      expect(screen.getByText('Payment ID: test-payment-789')).toBeInTheDocument();
    });

    it('should not display payment context when not provided', () => {
      render(
        <PaymentErrorBoundary>
          <ThrowPaymentError />
        </PaymentErrorBoundary>
      );

      expect(screen.queryByText('Payment Details:')).not.toBeInTheDocument();
    });

    it('should display partial payment context', () => {
      const paymentContext = {
        planId: 'test-plan-123'
        // Missing orderId and paymentId
      };

      render(
        <PaymentErrorBoundary paymentContext={paymentContext}>
          <ThrowPaymentError />
        </PaymentErrorBoundary>
      );

      expect(screen.getByText('Plan ID: test-plan-123')).toBeInTheDocument();
      expect(screen.queryByText('Order ID:')).not.toBeInTheDocument();
      expect(screen.queryByText('Payment ID:')).not.toBeInTheDocument();
    });
  });

  describe('Payment Error Boundary Actions', () => {
    it('should retry payment when Retry Payment is clicked', () => {
      const mockLocation = { href: 'http://localhost:3000' };
      Object.defineProperty(window, 'location', {
        value: mockLocation,
        writable: true
      });

      render(
        <PaymentErrorBoundary paymentContext={{ planId: 'test-plan-123' }}>
          <ThrowPaymentError />
        </PaymentErrorBoundary>
      );

      const retryButton = screen.getByText('Retry Payment');
      fireEvent.click(retryButton);

      expect(window.location.href).toBe('/checkout?planId=test-plan-123');
    });

    it('should navigate to pricing when no planId is provided', () => {
      const mockLocation = { href: 'http://localhost:3000' };
      Object.defineProperty(window, 'location', {
        value: mockLocation,
        writable: true
      });

      render(
        <PaymentErrorBoundary>
          <ThrowPaymentError />
        </PaymentErrorBoundary>
      );

      const retryButton = screen.getByText('Retry Payment');
      fireEvent.click(retryButton);

      expect(window.location.href).toBe('/pricing');
    });

    it('should navigate to pricing when Choose Different Plan is clicked', () => {
      const mockNavigate = jest.fn();
      jest.spyOn(require('react-router-dom'), 'useNavigate').mockReturnValue(mockNavigate);

      render(
        <PaymentErrorBoundary>
          <ThrowPaymentError />
        </PaymentErrorBoundary>
      );

      const choosePlanButton = screen.getByText('Choose Different Plan');
      fireEvent.click(choosePlanButton);

      expect(mockNavigate).toHaveBeenCalledWith('/pricing');
    });

    it('should navigate back when Go Back is clicked', () => {
      const mockNavigate = jest.fn();
      jest.spyOn(require('react-router-dom'), 'useNavigate').mockReturnValue(mockNavigate);

      render(
        <PaymentErrorBoundary>
          <ThrowPaymentError />
        </PaymentErrorBoundary>
      );

      const goBackButton = screen.getByText('Go Back');
      fireEvent.click(goBackButton);

      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });

    it('should contact support with payment context', () => {
      const mockLocation = { href: 'http://localhost:3000' };
      Object.defineProperty(window, 'location', {
        value: mockLocation,
        writable: true
      });

      const paymentContext = {
        planId: 'test-plan-123',
        orderId: 'test-order-456',
        paymentId: 'test-payment-789'
      };

      render(
        <PaymentErrorBoundary paymentContext={paymentContext}>
          <ThrowPaymentError />
        </PaymentErrorBoundary>
      );

      const contactSupportButton = screen.getByText('Contact Support');
      fireEvent.click(contactSupportButton);

      expect(window.location.href).toBe('/contact?context=payment&planId=test-plan-123&orderId=test-order-456&paymentId=test-payment-789');
    });

    it('should contact support with partial context', () => {
      const mockLocation = { href: 'http://localhost:3000' };
      Object.defineProperty(window, 'location', {
        value: mockLocation,
        writable: true
      });

      const paymentContext = {
        planId: 'test-plan-123'
        // Missing orderId and paymentId
      };

      render(
        <PaymentErrorBoundary paymentContext={paymentContext}>
          <ThrowPaymentError />
        </PaymentErrorBoundary>
      );

      const contactSupportButton = screen.getByText('Contact Support');
      fireEvent.click(contactSupportButton);

      expect(window.location.href).toBe('/contact?context=payment&planId=test-plan-123&orderId=&paymentId=');
    });
  });

  describe('Custom Error Handler', () => {
    it('should call custom error handler', () => {
      const onError = jest.fn();

      render(
        <PaymentErrorBoundary onError={onError}>
          <ThrowPaymentError />
        </PaymentErrorBoundary>
      );

      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String)
        })
      );
    });
  });

  describe('Development vs Production', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should show error details in development', () => {
      process.env.NODE_ENV = 'development';

      render(
        <PaymentErrorBoundary>
          <ThrowPaymentError />
        </PaymentErrorBoundary>
      );

      expect(screen.getByText('Error Details:')).toBeInTheDocument();
      expect(screen.getByText('Payment processing failed')).toBeInTheDocument();
      expect(screen.getByText('Component Stack')).toBeInTheDocument();
    });

    it('should not show error details in production', () => {
      process.env.NODE_ENV = 'production';

      render(
        <PaymentErrorBoundary>
          <ThrowPaymentError />
        </PaymentErrorBoundary>
      );

      expect(screen.queryByText('Error Details:')).not.toBeInTheDocument();
      expect(screen.queryByText('Payment processing failed')).not.toBeInTheDocument();
      expect(screen.queryByText('Component Stack')).not.toBeInTheDocument();
    });
  });

  describe('Payment Error Boundary Styling', () => {
    it('should have payment-specific styling', () => {
      render(
        <PaymentErrorBoundary>
          <ThrowPaymentError />
        </PaymentErrorBoundary>
      );

      const errorCard = screen.getByRole('article');
      expect(errorCard).toHaveClass('border-orange-200');

      const iconContainer = screen.getByText('Payment Processing Error').closest('div')?.previousElementSibling;
      expect(iconContainer).toHaveClass('bg-orange-100');
    });

    it('should have proper color scheme for payment errors', () => {
      render(
        <PaymentErrorBoundary>
          <ThrowPaymentError />
        </PaymentErrorBoundary>
      );

      const title = screen.getByText('Payment Processing Error');
      expect(title).toHaveClass('text-orange-800');

      const description = screen.getByText('We encountered an issue while processing your payment. Don\'t worry, your payment information is secure.');
      expect(description).toHaveClass('text-orange-600');
    });
  });

  describe('Payment Error Boundary Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(
        <PaymentErrorBoundary>
          <ThrowPaymentError />
        </PaymentErrorBoundary>
      );

      const errorCard = screen.getByRole('article');
      expect(errorCard).toBeInTheDocument();

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(4); // Retry Payment, Choose Different Plan, Go Back, Contact Support
    });

    it('should have proper heading structure', () => {
      render(
        <PaymentErrorBoundary>
          <ThrowPaymentError />
        </PaymentErrorBoundary>
      );

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('Payment Processing Error');
    });
  });

  describe('Payment Error Boundary Security Messages', () => {
    it('should display security reassurance messages', () => {
      render(
        <PaymentErrorBoundary>
          <ThrowPaymentError />
        </PaymentErrorBoundary>
      );

      expect(screen.getByText('Your payment information is secure and has not been charged.')).toBeInTheDocument();
      expect(screen.getByText('If you continue to experience issues, please contact our support team.')).toBeInTheDocument();
    });
  });

  describe('Payment Error Boundary Integration', () => {
    it('should work with React Router navigation', () => {
      const mockNavigate = jest.fn();
      jest.spyOn(require('react-router-dom'), 'useNavigate').mockReturnValue(mockNavigate);

      render(
        <PaymentErrorBoundary>
          <ThrowPaymentError />
        </PaymentErrorBoundary>
      );

      const choosePlanButton = screen.getByText('Choose Different Plan');
      fireEvent.click(choosePlanButton);

      expect(mockNavigate).toHaveBeenCalledWith('/pricing');
    });
  });
}); 