import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { setupTestEnvironment, createMockError, mockSafeLog } from '../../utils/testUtils';
import { ErrorBoundary } from '../ErrorBoundary';

// Mock dependencies
jest.mock('../../utils/safeLogging', () => ({
  safeLog: mockSafeLog
}));

// Component that throws an error
const ThrowError = ({ shouldThrow = false }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>Normal component</div>;
};

// Component that throws an error in render
const ThrowErrorInRender = () => {
  throw new Error('Render error');
};

describe('ErrorBoundary', () => {
  setupTestEnvironment();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Error Boundary Functionality', () => {
    it('should render children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <div>Test content</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('should catch errors and show error UI', () => {
      render(
        <ErrorBoundary>
          <ThrowErrorInRender />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('We\'re sorry, but something unexpected happened. Our team has been notified.')).toBeInTheDocument();
    });

    it('should log error details', () => {
      render(
        <ErrorBoundary>
          <ThrowErrorInRender />
        </ErrorBoundary>
      );

      expect(mockSafeLog.error).toHaveBeenCalledWith('Error boundary caught an error:', expect.objectContaining({
        error: 'Render error',
        errorId: expect.any(String),
        location: expect.any(String),
        userAgent: expect.any(String)
      }));
    });

    it('should generate unique error ID', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowErrorInRender />
        </ErrorBoundary>
      );

      const firstErrorId = mockSafeLog.error.mock.calls[0][1].errorId;

      // Render again to trigger another error
      rerender(
        <ErrorBoundary>
          <ThrowErrorInRender />
        </ErrorBoundary>
      );

      const secondErrorId = mockSafeLog.error.mock.calls[1][1].errorId;

      expect(firstErrorId).not.toBe(secondErrorId);
    });
  });

  describe('Error Boundary Actions', () => {
    it('should reset error state when Try Again is clicked', () => {
      render(
        <ErrorBoundary>
          <ThrowErrorInRender />
        </ErrorBoundary>
      );

      const tryAgainButton = screen.getByText('Try Again');
      fireEvent.click(tryAgainButton);

      // Should still show error UI since the component still throws
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('should navigate home when Go Home is clicked', () => {
      const mockNavigate = jest.fn();
      jest.spyOn(require('react-router-dom'), 'useNavigate').mockReturnValue(mockNavigate);

      render(
        <ErrorBoundary>
          <ThrowErrorInRender />
        </ErrorBoundary>
      );

      const goHomeButton = screen.getByText('Go Home');
      fireEvent.click(goHomeButton);

      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('should navigate back when Go Back is clicked', () => {
      const mockNavigate = jest.fn();
      jest.spyOn(require('react-router-dom'), 'useNavigate').mockReturnValue(mockNavigate);

      render(
        <ErrorBoundary>
          <ThrowErrorInRender />
        </ErrorBoundary>
      );

      const goBackButton = screen.getByText('Go Back');
      fireEvent.click(goBackButton);

      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });

    it('should report error when Report this error is clicked', () => {
      render(
        <ErrorBoundary>
          <ThrowErrorInRender />
        </ErrorBoundary>
      );

      const reportButton = screen.getByText('Report this error');
      fireEvent.click(reportButton);

      expect(mockSafeLog.error).toHaveBeenCalledWith('User reported error:', expect.objectContaining({
        errorId: expect.any(String),
        error: 'Render error',
        url: expect.any(String),
        timestamp: expect.any(String)
      }));
    });
  });

  describe('Custom Fallback UI', () => {
    it('should render custom fallback when provided', () => {
      const CustomFallback = () => <div>Custom error UI</div>;

      render(
        <ErrorBoundary fallback={<CustomFallback />}>
          <ThrowErrorInRender />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom error UI')).toBeInTheDocument();
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });
  });

  describe('Error Boundary with Custom Error Handler', () => {
    it('should call custom error handler', () => {
      const onError = jest.fn();

      render(
        <ErrorBoundary onError={onError}>
          <ThrowErrorInRender />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String)
        })
      );
    });
  });

  describe('Props-based Reset', () => {
    it('should reset error state when props change and resetOnPropsChange is true', () => {
      const { rerender } = render(
        <ErrorBoundary resetOnPropsChange>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // Should show error UI
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // Change props to trigger reset
      rerender(
        <ErrorBoundary resetOnPropsChange>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      // Should show normal content
      expect(screen.getByText('Normal component')).toBeInTheDocument();
    });

    it('should not reset error state when resetOnPropsChange is false', () => {
      const { rerender } = render(
        <ErrorBoundary resetOnPropsChange={false}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // Should show error UI
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // Change props - should not reset
      rerender(
        <ErrorBoundary resetOnPropsChange={false}>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      // Should still show error UI
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
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
        <ErrorBoundary>
          <ThrowErrorInRender />
        </ErrorBoundary>
      );

      expect(screen.getByText('Error Details:')).toBeInTheDocument();
      expect(screen.getByText('Render error')).toBeInTheDocument();
      expect(screen.getByText('Component Stack')).toBeInTheDocument();
    });

    it('should not show error details in production', () => {
      process.env.NODE_ENV = 'production';

      render(
        <ErrorBoundary>
          <ThrowErrorInRender />
        </ErrorBoundary>
      );

      expect(screen.queryByText('Error Details:')).not.toBeInTheDocument();
      expect(screen.queryByText('Render error')).not.toBeInTheDocument();
      expect(screen.queryByText('Component Stack')).not.toBeInTheDocument();
    });
  });

  describe('Error Boundary Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(
        <ErrorBoundary>
          <ThrowErrorInRender />
        </ErrorBoundary>
      );

      const errorCard = screen.getByRole('article');
      expect(errorCard).toBeInTheDocument();

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(4); // Try Again, Go Home, Go Back, Report this error
    });

    it('should have proper heading structure', () => {
      render(
        <ErrorBoundary>
          <ThrowErrorInRender />
        </ErrorBoundary>
      );

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('Something went wrong');
    });
  });

  describe('Error Boundary Integration', () => {
    it('should work with React Router navigation', () => {
      const mockNavigate = jest.fn();
      jest.spyOn(require('react-router-dom'), 'useNavigate').mockReturnValue(mockNavigate);

      render(
        <ErrorBoundary>
          <ThrowErrorInRender />
        </ErrorBoundary>
      );

      const goHomeButton = screen.getByText('Go Home');
      fireEvent.click(goHomeButton);

      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('should work with Link component', () => {
      render(
        <ErrorBoundary>
          <ThrowErrorInRender />
        </ErrorBoundary>
      );

      const contactLink = screen.getByText('Contact Support');
      expect(contactLink).toHaveAttribute('href', '/contact');
    });
  });
}); 